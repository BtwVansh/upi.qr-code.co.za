/**
 * End-to-end smoke test against a running server and the real database.
 *
 *   npm run smoke
 *
 * Assumes the mock provider is enabled (the default local .env) so phone
 * resolution scenarios can be exercised deterministically.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { decryptPii } from "../src/lib/crypto";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail?: string): void {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function post(input: string): Promise<{
  status: number;
  body: {
    ok?: boolean;
    requestId?: string;
    redirectTo?: string;
    error?: { code?: string; message?: string; hint?: string; requestId?: string };
  };
}> {
  const response = await fetch(`${BASE}/api/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  return { status: response.status, body: await response.json() };
}

async function main(): Promise<void> {
  console.log(`\nSmoke testing ${BASE}\n`);

  console.log("Health");
  const healthResponse = await fetch(`${BASE}/api/health`);
  const health = (await healthResponse.json()) as {
    database?: string;
    encryptionConfigured?: boolean;
  };
  check("health endpoint responds", healthResponse.status === 200);
  check("database is up", health.database === "up");
  check("encryption keys are configured", health.encryptionConfigured === true);

  console.log("\nScenario 2: invalid UPI ID");
  const invalid = await post("bad@@upi");
  check("returns 400", invalid.status === 400, String(invalid.status));
  check("returns VALIDATION_ERROR", invalid.body.error?.code === "VALIDATION_ERROR");
  const invalidRow = invalid.body.error?.requestId
    ? await prisma.paymentRequest.findUnique({
        where: { requestId: invalid.body.error.requestId },
      })
    : null;
  check("invalid submission is logged", invalidRow?.inputType === "INVALID");
  check(
    "invalid input is encrypted",
    Boolean(
      invalidRow &&
        !invalidRow.originalInputEnc.includes("bad@@upi") &&
        decryptPii(invalidRow.originalInputEnc) === "bad@@upi",
    ),
  );

  console.log("\nScenario 1 + 7: valid UPI ID and QR generation");
  const upi = await post("merchant@upi");
  check("returns 200", upi.status === 200, String(upi.status));
  check("returns a request id", Boolean(upi.body.requestId));
  check("returns a redirect", upi.body.redirectTo?.startsWith("/pay/pr_") === true);
  const requestId = upi.body.requestId as string;

  if (requestId) {
    const page = await fetch(`${BASE}/pay/${requestId}`);
    const html = await page.text();
    check("payment page renders", page.status === 200);
    check("page shows the UPI ID", html.includes("merchant@upi"));
    check("page shows the verified beneficiary", html.includes("Demo Merchant"));
    check("page contains Open in UPI App", html.includes("Open in UPI App"));
    check("payment pages are noindex", page.headers.get("x-robots-tag")?.includes("noindex") === true);

    const qr = await fetch(`${BASE}/api/pay/${requestId}/qr`);
    const qrBytes = new Uint8Array(await qr.arrayBuffer());
    check("QR endpoint returns PNG", qr.headers.get("content-type") === "image/png");
    check(
      "QR contains a PNG signature",
      qrBytes[0] === 0x89 && qrBytes[1] === 0x50 && qrBytes[2] === 0x4e,
    );

    const qrWithAmount = await fetch(
      `${BASE}/api/pay/${requestId}/qr?amount=250&note=Coffee`,
    );
    check("QR accepts amount and note", qrWithAmount.status === 200);
    const invalidAmount = await fetch(
      `${BASE}/api/pay/${requestId}/qr?amount=-1`,
    );
    check("QR rejects an invalid amount", invalidAmount.status === 400);

    const row = await prisma.paymentRequest.findUnique({
      where: { requestId },
      include: { events: true },
    });
    check("row is logged", Boolean(row));
    check("verification is recorded", row?.verificationStatus === "VERIFIED");
    check("QR status is recorded", row?.qrStatus === "SUCCESS");
    check("payment URI status is recorded", row?.paymentUriStatus === "SUCCESS");
    check("processing duration is recorded", (row?.processingMs ?? 0) > 0);
    check("provider attempt is logged", (row?.events.length ?? 0) > 0);
    check(
      "UPI ID is encrypted at rest",
      Boolean(row && !row.resolvedUpiIdEnc?.includes("merchant@upi")),
    );
    check(
      "beneficiary name is encrypted at rest",
      Boolean(row && !row.beneficiaryNameEnc?.includes("Demo Merchant")),
    );
    check("IP is stored as a hash", row?.ipHash?.length === 64);
  }

  console.log("\nScenario 3: valid Indian phone number (mock resolution)");
  const phone = await post("+91 98765 43210");
  check("returns 200", phone.status === 200, String(phone.status));
  check("redirects to a payment page", Boolean(phone.body.redirectTo));
  if (phone.body.requestId) {
    const row = await prisma.paymentRequest.findUnique({
      where: { requestId: phone.body.requestId },
    });
    check("resolution is recorded", row?.resolutionStatus === "RESOLVED");
    check(
      "resolved UPI ID is encrypted",
      Boolean(row && decryptPii(row.resolvedUpiIdEnc) === "demo@upi"),
    );
    check(
      "beneficiary name is stored",
      Boolean(row && decryptPii(row.beneficiaryNameEnc) === "Demo User"),
    );
    const page = await fetch(`${BASE}/pay/${phone.body.requestId}`);
    const html = await page.text();
    check("page shows resolved beneficiary", html.includes("Demo User"));
    check("page shows resolved UPI ID", html.includes("demo@upi"));
  }

  console.log("\nScenario 4: unregistered phone number");
  const unregistered = await post("9999999999");
  check("returns 404", unregistered.status === 404, String(unregistered.status));
  check(
    "returns UPI_NUMBER_NOT_FOUND",
    unregistered.body.error?.code === "UPI_NUMBER_NOT_FOUND",
  );
  check(
    "offers manual UPI ID fallback",
    unregistered.body.error?.hint?.includes("UPI ID") === true,
  );

  console.log("\nScenario 6: provider failure");
  const providerFailure = await post("9000000000");
  check("returns 502", providerFailure.status === 502, String(providerFailure.status));
  check(
    "returns RESOLUTION_FAILED",
    providerFailure.body.error?.code === "RESOLUTION_FAILED",
  );
  if (providerFailure.body.error?.requestId) {
    const row = await prisma.paymentRequest.findUnique({
      where: { requestId: providerFailure.body.error.requestId },
    });
    check("failure is logged", row?.resolutionStatus === "FAILED");
    check("no UPI ID was guessed", row?.resolvedUpiIdEnc === null);
  }

  console.log("\nVerification warning path");
  const verificationFailed = await post("failure@upi");
  check("failure does not block the payment page", verificationFailed.status === 200);
  if (verificationFailed.body.requestId) {
    const row = await prisma.paymentRequest.findUnique({
      where: { requestId: verificationFailed.body.requestId },
    });
    check("verification failure is logged", row?.verificationStatus === "FAILED");
    check("QR is still generated", row?.qrStatus === "SUCCESS");
  }

  console.log("\nAdmin authentication");
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const unauth = await fetch(`${BASE}/admin`);
  const unauthHtml = await unauth.text();
  check("unauthenticated admin page shows login", unauthHtml.includes("Admin console"));
  check(
    "unauthenticated admin page hides data",
    !unauthHtml.includes("Recent submissions"),
  );

  const badLogin = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "definitely-wrong" }),
  });
  check("wrong password is rejected", badLogin.status === 401);

  if (adminPassword) {
    const login = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    });
    check("admin login succeeds", login.status === 200);
    const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    check("session cookie is HTTP-only", /httponly/i.test(login.headers.get("set-cookie") ?? ""));
    const dashboard = await fetch(`${BASE}/admin`, {
      headers: { cookie },
    });
    const dashboardHtml = await dashboard.text();
    check("authenticated dashboard renders", dashboard.status === 200);
    check(
      "dashboard includes request logs",
      dashboardHtml.includes("Recent submissions"),
    );
    check(
      "dashboard exposes decrypted fields to admins",
      dashboardHtml.includes("demo@upi") || dashboardHtml.includes("merchant@upi"),
    );

    const liveLogout = await fetch(`${BASE}/api/admin/logout`, {
      method: "POST",
      headers: { cookie },
    });
    check("logout succeeds", liveLogout.status === 200);
  } else {
    console.log("  · ADMIN_PASSWORD not set; skipping authenticated dashboard check");
  }

  console.log("\nRetention");
  const unauthorized = await fetch(`${BASE}/api/maintenance/retention`, {
    method: "POST",
  });
  check("retention endpoint rejects missing cron secret", unauthorized.status === 401);
  if (process.env.CRON_SECRET) {
    const retention = await fetch(`${BASE}/api/maintenance/retention`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    check("cron retention run succeeds", retention.status === 200);
  }

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\nSmoke test crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
