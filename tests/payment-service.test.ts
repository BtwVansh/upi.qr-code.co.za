import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { decryptPii } from "@/lib/crypto";
import {
  createPaymentRequest,
  type ServiceDeps,
  type ServiceResult,
} from "@/lib/payment-service";
import type {
  ResolutionProvider,
  VerificationProvider,
} from "@/lib/providers/types";

const createdRequestIds: string[] = [];
let lastQrPayload = "";

function track(result: ServiceResult): ServiceResult {
  if (result.requestId) createdRequestIds.push(result.requestId);
  return result;
}

function serviceDeps(overrides: Partial<ServiceDeps> = {}): ServiceDeps {
  return {
    db: prisma,
    resolutionProvider: null,
    verificationProvider: null,
    generateQr: async (payload) => {
      lastQrPayload = payload;
      return Buffer.from("fake-png");
    },
    now: () => new Date("2026-01-15T10:00:00.000Z"),
    ...overrides,
  };
}

function resolutionProvider(
  result: Awaited<ReturnType<ResolutionProvider["resolveByPhone"]>>,
): ResolutionProvider {
  return {
    name: "test-provider",
    displayName: "Test provider",
    resolveByPhone: async () => result,
  };
}

function verificationProvider(
  result: Awaited<ReturnType<VerificationProvider["verifyUpi"]>>,
): VerificationProvider {
  return {
    name: "test-verifier",
    displayName: "Test verifier",
    verifyUpi: async () => result,
  };
}

async function getRow(requestId: string) {
  return prisma.paymentRequest.findUniqueOrThrow({
    where: { requestId },
    include: { events: true },
  });
}

afterAll(async () => {
  if (createdRequestIds.length > 0) {
    await prisma.paymentRequest.deleteMany({
      where: { requestId: { in: createdRequestIds } },
    });
  }
  await prisma.$disconnect();
});

describe("createPaymentRequest", () => {
  it("logs invalid submissions without creating a payable request", async () => {
    const result = track(
      await createPaymentRequest("not a payment id", {}, serviceDeps()),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.code).toBe("VALIDATION_ERROR");

    const row = await getRow(result.requestId as string);
    expect(row.inputType).toBe("INVALID");
    expect(row.resolvedUpiIdEnc).toBeNull();
    expect(row.paymentUriStatus).toBe("FAILED");
    expect(decryptPii(row.originalInputEnc)).toBe("not a payment id");
    expect(decryptPii(row.errorMessageEnc)).toContain("phone number or UPI ID");
    expect(row.originalInputEnc).not.toContain("not a payment id");
  });

  it("generates a direct UPI request with no provider configured", async () => {
    const result = track(
      await createPaymentRequest(
        "Direct@UPI",
        { ip: "203.0.113.9", userAgent: "vitest" },
        serviceDeps(),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await getRow(result.requestId);
    expect(row.inputType).toBe("UPI");
    expect(row.verificationStatus).toBe("NOT_REQUESTED");
    expect(row.paymentUriStatus).toBe("SUCCESS");
    expect(row.qrStatus).toBe("SUCCESS");
    expect(decryptPii(row.normalizedValueEnc)).toBe("direct@upi");
    expect(decryptPii(row.resolvedUpiIdEnc)).toBe("direct@upi");
    expect(decryptPii(row.originalInputEnc)).toBe("Direct@UPI");
    expect(row.ipHash).toHaveLength(64);
    expect(row.userAgentEnc).not.toContain("vitest");
    expect(decryptPii(row.userAgentEnc)).toBe("vitest");
    expect(lastQrPayload).toBe("upi://pay?pa=direct@upi&cu=INR");

    const retentionMs = row.expiresAt.getTime() - row.createdAt.getTime();
    expect(Math.round(retentionMs / 86_400_000)).toBe(30);
  });

  it("keeps the payment page when verification fails, with a logged error", async () => {
    const result = track(
      await createPaymentRequest(
        "merchant@upi",
        {},
        serviceDeps({
          verificationProvider: verificationProvider({
            outcome: "failed",
            durationMs: 12,
            httpStatus: 503,
            responseCode: "HTTP_503",
            errorCode: "PROVIDER_UNAVAILABLE",
            errorMessage: "Provider is down.",
          }),
        }),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await getRow(result.requestId);
    expect(row.verificationStatus).toBe("FAILED");
    expect(row.errorCode).toBe("PROVIDER_UNAVAILABLE");
    expect(row.resolvedUpiIdEnc).not.toBeNull();
    expect(row.qrStatus).toBe("SUCCESS");
    expect(row.events).toHaveLength(1);
    expect(row.events[0].kind).toBe("VERIFICATION");
    expect(row.events[0].outcome).toBe("failed");
    expect(decryptPii(row.events[0].errorMessageEnc)).toBe(
      "Provider is down.",
    );
  });

  it("records a verified direct UPI beneficiary and includes the name in the QR", async () => {
    const result = track(
      await createPaymentRequest(
        "demo@upi",
        {},
        serviceDeps({
          verificationProvider: verificationProvider({
            outcome: "verified",
            durationMs: 8,
            name: "Demo User",
            verified: true,
            responseCode: "OK",
            reference: "ref-1",
          }),
        }),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await getRow(result.requestId);
    expect(row.verificationStatus).toBe("VERIFIED");
    expect(row.beneficiaryVerified).toBe(true);
    expect(decryptPii(row.beneficiaryNameEnc)).toBe("Demo User");
    expect(lastQrPayload).toBe(
      "upi://pay?pa=demo@upi&pn=Demo%20User&cu=INR",
    );
  });

  it("explains that phone resolution is unavailable when no provider exists", async () => {
    const result = track(
      await createPaymentRequest("9876543210", {}, serviceDeps()),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(result.code).toBe("PHONE_RESOLUTION_UNAVAILABLE");
    expect(result.hint).toContain("UPI ID");

    const row = await getRow(result.requestId as string);
    expect(row.inputType).toBe("PHONE");
    expect(row.resolutionStatus).toBe("UNAVAILABLE");
    expect(row.qrStatus).toBe("FAILED");
    expect(row.processingMs).toBeGreaterThan(0);
    expect(decryptPii(row.normalizedValueEnc)).toBe("+919876543210");
  });

  it("resolves a phone number and stores encrypted beneficiary details", async () => {
    const result = track(
      await createPaymentRequest(
        "+91 98765 43210",
        {},
        serviceDeps({
          resolutionProvider: resolutionProvider({
            outcome: "resolved",
            durationMs: 21,
            httpStatus: 200,
            upiId: "Resolved@UPI",
            name: "Resolved User",
            verified: true,
            responseCode: "OK",
            reference: "ref-phone",
            raw: { status: "success" },
          }),
        }),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await getRow(result.requestId);
    expect(row.resolutionStatus).toBe("RESOLVED");
    expect(decryptPii(row.resolvedUpiIdEnc)).toBe("resolved@upi");
    expect(decryptPii(row.beneficiaryNameEnc)).toBe("Resolved User");
    expect(row.beneficiaryVerified).toBe(true);
    expect(row.provider).toBe("test-provider");
    expect(row.paymentUriStatus).toBe("SUCCESS");
    expect(row.qrStatus).toBe("SUCCESS");
    expect(row.events).toHaveLength(1);
    expect(row.events[0].kind).toBe("RESOLUTION");

    expect(row.resolvedUpiIdEnc).not.toContain("resolved@upi");
    expect(row.beneficiaryNameEnc).not.toContain("Resolved User");
    expect(row.providerMetadataEnc).not.toContain("success");
  });

  it("returns a manual fallback when the number is not registered", async () => {
    const result = track(
      await createPaymentRequest(
        "9999999999",
        {},
        serviceDeps({
          resolutionProvider: resolutionProvider({
            outcome: "not_found",
            durationMs: 11,
            errorCode: "UPI_NUMBER_NOT_FOUND",
            errorMessage: "No UPI ID linked.",
            responseCode: "NOT_FOUND",
          }),
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
    expect(result.code).toBe("UPI_NUMBER_NOT_FOUND");
    expect(result.hint).toContain("never guess");

    const row = await getRow(result.requestId as string);
    expect(row.resolutionStatus).toBe("NOT_FOUND");
    expect(row.qrStatus).toBe("FAILED");
  });

  it("returns a provider failure without guessing a UPI ID", async () => {
    const result = track(
      await createPaymentRequest(
        "9000000000",
        {},
        serviceDeps({
          resolutionProvider: resolutionProvider({
            outcome: "failed",
            durationMs: 8_000,
            httpStatus: 504,
            errorCode: "PROVIDER_TIMEOUT",
            errorMessage: "Timed out.",
          }),
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(502);
    expect(result.code).toBe("RESOLUTION_FAILED");

    const row = await getRow(result.requestId as string);
    expect(row.resolutionStatus).toBe("FAILED");
    expect(row.resolvedUpiIdEnc).toBeNull();
    expect(row.errorCode).toBe("PROVIDER_TIMEOUT");
  });

  it("rejects a malformed UPI ID returned by a resolution provider", async () => {
    const result = track(
      await createPaymentRequest(
        "9123456780",
        {},
        serviceDeps({
          resolutionProvider: resolutionProvider({
            outcome: "resolved",
            durationMs: 4,
            upiId: "broken@@upi",
            name: "Broken",
            verified: true,
          }),
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(502);
    expect(result.code).toBe("RESOLUTION_FAILED");

    const row = await getRow(result.requestId as string);
    expect(row.resolutionStatus).toBe("FAILED");
    expect(row.errorCode).toBe("PROVIDER_INVALID_UPI_ID");
    expect(row.resolvedUpiIdEnc).toBeNull();
  });

  it("survives a provider that throws", async () => {
    const throwingProvider: ResolutionProvider = {
      name: "thrower",
      displayName: "Thrower",
      resolveByPhone: async () => {
        throw new Error("boom");
      },
    };
    const result = track(
      await createPaymentRequest(
        "8888888888",
        {},
        serviceDeps({ resolutionProvider: throwingProvider }),
      ),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("RESOLUTION_FAILED");

    const row = await getRow(result.requestId as string);
    expect(row.errorCode).toBe("PROVIDER_EXCEPTION");
    expect(row.events[0].outcome).toBe("failed");
  });
});
