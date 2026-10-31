import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tryDecryptJson, tryDecryptPii } from "@/lib/crypto";
import { getConfig } from "@/lib/config";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getProviderDiagnostics } from "@/lib/providers";
import { AdminLoginForm } from "@/components/admin-login-form";
import { AdminActions } from "@/components/admin-actions";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  InfoIcon,
  LockIcon,
  ShieldCheckIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin console",
  robots: { index: false, follow: false, nocache: true },
};

type AdminRow = Prisma.PaymentRequestGetPayload<{ include: { events: true } }>;

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function format(value: Date): string {
  return dateTime.format(value);
}

function statusClass(status: string): string {
  if (status === "RESOLVED" || status === "VERIFIED" || status === "SUCCESS") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "FAILED" || status === "NOT_FOUND") {
    return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  if (status === "UNAVAILABLE" || status === "PENDING") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-line bg-[var(--elevated)] text-muted";
}

function maskInput(value: string | null, type: string): string {
  if (!value) return "—";
  if (type === "UPI" && value.includes("@")) {
    const [local, handle] = value.split("@");
    return `${local.slice(0, 2)}•••@${handle}`;
  }
  if (type === "PHONE") {
    return `${value.slice(0, 4)}••••${value.slice(-2)}`;
  }
  return value.length > 8 ? `${value.slice(0, 4)}…` : value;
}

function view(row: AdminRow) {
  return {
    ...row,
    originalInput: tryDecryptPii(row.originalInputEnc),
    normalized: tryDecryptPii(row.normalizedValueEnc),
    resolvedUpiId: tryDecryptPii(row.resolvedUpiIdEnc),
    beneficiaryName: tryDecryptPii(row.beneficiaryNameEnc),
    providerReference: tryDecryptPii(row.providerReferenceEnc),
    providerMetadata: (() => {
      const parsed = tryDecryptJson(row.providerMetadataEnc);
      return parsed ? JSON.stringify(parsed, null, 2) : null;
    })(),
    errorMessage: tryDecryptPii(row.errorMessageEnc),
    userAgent: tryDecryptPii(row.userAgentEnc),
    events: row.events.map((event) => ({
      ...event,
      errorMessage: tryDecryptPii(event.errorMessageEnc),
    })),
  };
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-[12px] leading-relaxed ${
          mono ? "mono text-[11px]" : ""
        }`}
      >
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}

export default async function AdminPage() {
  const config = getConfig();
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return (
      <div className="mx-auto w-full max-w-md px-5 pb-16 pt-14 sm:pt-20">
        <div className="surface-card animate-fade-up rounded-[32px] p-7 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] text-white">
            <LockIcon className="h-5 w-5" />
          </div>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Restricted
          </p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.04em]">
            Admin console
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Beta diagnostics, provider outcomes and request logs. Authorised
            operators only.
          </p>
          <AdminLoginForm disabled={!config.adminEnabled} />
          <p className="mt-5 flex items-start gap-2 text-[10.5px] leading-relaxed text-muted">
            <ShieldCheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Session cookies are HTTP-only and expire after 8 hours. Login
            attempts are rate limited.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-ink"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to UPI Pay
          </Link>
        </div>
      </div>
    );
  }

  let rows: ReturnType<typeof view>[] = [];
  let total = 0;
  let last24h = 0;
  let resolved = 0;
  let withErrors = 0;
  let databaseError = false;

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [list, totalCount, recentCount, resolvedCount, errorCount] =
      await Promise.all([
        prisma.paymentRequest.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { events: { orderBy: { createdAt: "asc" } } },
        }),
        prisma.paymentRequest.count(),
        prisma.paymentRequest.count({ where: { createdAt: { gte: since } } }),
        prisma.paymentRequest.count({
          where: { resolutionStatus: "RESOLVED" },
        }),
        prisma.paymentRequest.count({
          where: { errorCode: { not: null } },
        }),
      ]);
    rows = list.map(view);
    total = totalCount;
    last24h = recentCount;
    resolved = resolvedCount;
    withErrors = errorCount;
  } catch {
    databaseError = true;
  }

  const diagnostics = getProviderDiagnostics();
  const testMode =
    diagnostics.resolution.mode === "mock" ||
    diagnostics.verification.mode === "mock";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-12 pt-4 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-ink"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to UPI Pay
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <h1 className="text-[30px] font-semibold tracking-[-0.045em] sm:text-[38px]">
              Operations console
            </h1>
            <span className="rounded-full border border-line px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
              Beta
            </span>
          </div>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
            Latest 50 submissions. Personal fields are decrypted only for this
            authenticated view — do not share screenshots.
          </p>
        </div>
        <AdminActions retentionDays={config.retentionDays} />
      </div>

      {testMode && (
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[12px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">Mock provider active.</span>{" "}
            Phone resolution and beneficiary verification return simulated
            data. Disable <code>UPI_MOCK_PROVIDER</code> before production.
          </p>
        </div>
      )}

      {(!config.encryptionKeyPresent || !config.indexKeyPresent) && (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/[0.07] p-3.5">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--danger)]" />
          <p className="text-[12px] leading-relaxed text-muted">
            Encryption is not fully configured. Set{" "}
            <code>APP_ENCRYPTION_KEY</code> and <code>APP_INDEX_KEY</code>{" "}
            before storing requests.
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total requests", value: total },
          { label: "Last 24 hours", value: last24h },
          { label: "Resolved numbers", value: resolved },
          { label: "Requests with errors", value: withErrors },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-line bg-surface p-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              {stat.label}
            </p>
            <p className="mt-1.5 text-[26px] font-semibold tracking-[-0.04em]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2.5 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Phone resolution
          </p>
          <p className="mt-1.5 text-[14px] font-semibold capitalize">
            {diagnostics.resolution.mode}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Requested: {diagnostics.resolution.requested}
            {diagnostics.resolution.inactiveReason
              ? ` · ${diagnostics.resolution.inactiveReason}`
              : ""}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Beneficiary verification
          </p>
          <p className="mt-1.5 text-[14px] font-semibold capitalize">
            {diagnostics.verification.mode}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Requested: {diagnostics.verification.requested}
            {diagnostics.verification.inactiveReason
              ? ` · ${diagnostics.verification.inactiveReason}`
              : ""}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Retention policy
          </p>
          <p className="mt-1.5 text-[14px] font-semibold">
            {config.retentionDays} days
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Rows expire automatically and are purged by the retention job.
          </p>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
          Recent submissions
        </h2>
        <span className="text-[11px] text-muted">Newest first</span>
      </div>

      {databaseError ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-5">
          <AlertTriangleIcon className="h-4 w-4 text-[color:var(--danger)]" />
          <p className="text-[12px] leading-relaxed text-muted">
            The database is unavailable, so request logs can&apos;t be loaded.
            Check <code>DATABASE_URL</code> and the PostgreSQL service.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-line bg-surface p-8 text-center">
          <InfoIcon className="mx-auto h-6 w-6 text-muted" />
          <p className="mt-3 text-[13px] font-medium">No requests yet.</p>
          <p className="mt-1 text-[11px] text-muted">
            Submissions will appear here with full provider diagnostics.
          </p>
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((row) => {
            const title = row.beneficiaryName || row.resolvedUpiId || "Request";
            return (
              <details
                key={row.id}
                className="group border-b border-line last:border-b-0"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-4 transition-colors hover:bg-accent-soft sm:grid sm:grid-cols-[1.6fr_1.1fr_1fr_0.75fr_auto] sm:items-center sm:gap-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <p className="mono truncate text-[11px] font-medium text-ink">
                      {row.requestId}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {maskInput(row.originalInput, row.inputType)} ·{" "}
                      {title === "Request" ? "—" : title}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-line bg-[var(--elevated)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
                      {row.inputType}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${statusClass(
                        row.inputType === "UPI"
                          ? row.verificationStatus
                          : row.resolutionStatus,
                      )}`}
                    >
                      {row.inputType === "UPI"
                        ? row.verificationStatus
                        : row.resolutionStatus}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-muted sm:hidden">
                    {format(row.createdAt)}
                  </span>
                  <span className="hidden text-[10.5px] text-muted sm:block">
                    {format(row.createdAt)}
                  </span>
                  <span className="hidden text-[10.5px] text-muted sm:block">
                    {row.provider ?? "—"}
                  </span>
                  <ChevronDownIcon className="hidden h-4 w-4 text-muted transition-transform group-open:rotate-180 sm:block" />
                </summary>

                <div className="border-t border-line bg-[var(--elevated)] px-4 py-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field
                      label="Original input"
                      value={row.originalInput}
                      mono
                    />
                    <Field
                      label="Normalized value"
                      value={row.normalized}
                      mono
                    />
                    <Field label="Classification" value={row.inputType} />
                    <Field label="Request ID" value={row.requestId} mono />
                    <Field
                      label="Resolved UPI ID"
                      value={row.resolvedUpiId}
                      mono
                    />
                    <Field
                      label="Beneficiary name"
                      value={row.beneficiaryName}
                    />
                    <Field
                      label="Name verified"
                      value={row.beneficiaryVerified ? "Yes" : "No"}
                    />
                    <Field label="Provider" value={row.provider} />
                    <Field
                      label="Resolution status"
                      value={row.resolutionStatus}
                    />
                    <Field
                      label="Verification status"
                      value={row.verificationStatus}
                    />
                    <Field
                      label="Provider response code"
                      value={row.providerResponseCode}
                      mono
                    />
                    <Field
                      label="Provider reference"
                      value={row.providerReference}
                      mono
                    />
                    <Field label="Error code" value={row.errorCode} mono />
                    <Field label="Error message" value={row.errorMessage} />
                    <Field
                      label="Payment URI"
                      value={row.paymentUriStatus}
                    />
                    <Field label="QR generation" value={row.qrStatus} />
                    <Field
                      label="Processing duration"
                      value={`${row.processingMs} ms`}
                    />
                    <Field label="Created" value={format(row.createdAt)} />
                    <Field label="Expires" value={format(row.expiresAt)} />
                    <Field label="IP hash" value={row.ipHash} mono />
                    <Field
                      label="User agent"
                      value={row.userAgent}
                      mono
                    />
                    <Field
                      label="Amount / note"
                      value="Chosen on the payment page; not stored"
                    />
                  </div>

                  {row.providerMetadata && (
                    <div className="mt-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                        Provider metadata (decrypted)
                      </p>
                      <pre className="no-scrollbar mt-1.5 max-h-56 overflow-auto rounded-xl border border-line bg-[var(--bg)] p-3 text-[10px] leading-relaxed text-muted">
                        {row.providerMetadata}
                      </pre>
                    </div>
                  )}

                  <div className="mt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                      Provider attempts ({row.events.length})
                    </p>
                    {row.events.length === 0 ? (
                      <p className="mt-1.5 text-[11px] text-muted">
                        No provider was called for this request.
                      </p>
                    ) : (
                      <div className="no-scrollbar mt-1.5 overflow-x-auto rounded-xl border border-line">
                        <table className="w-full min-w-[720px] border-collapse text-left text-[10.5px]">
                          <thead className="bg-[var(--bg)] text-muted">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Kind</th>
                              <th className="px-3 py-2 font-semibold">
                                Provider
                              </th>
                              <th className="px-3 py-2 font-semibold">
                                Outcome
                              </th>
                              <th className="px-3 py-2 font-semibold">HTTP</th>
                              <th className="px-3 py-2 font-semibold">Code</th>
                              <th className="px-3 py-2 font-semibold">Error</th>
                              <th className="px-3 py-2 font-semibold">
                                Duration
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.events.map((event) => (
                              <tr
                                key={event.id}
                                className="border-t border-line"
                              >
                                <td className="px-3 py-2">{event.kind}</td>
                                <td className="px-3 py-2">{event.provider}</td>
                                <td className="px-3 py-2">{event.outcome}</td>
                                <td className="px-3 py-2">
                                  {event.httpStatus ?? "—"}
                                </td>
                                <td className="mono px-3 py-2">
                                  {event.responseCode ?? event.errorCode ?? "—"}
                                </td>
                                <td className="max-w-[220px] px-3 py-2">
                                  {event.errorMessage ?? "—"}
                                </td>
                                <td className="px-3 py-2">
                                  {event.durationMs} ms
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      <p className="mt-5 flex items-start gap-2 text-[10.5px] leading-relaxed text-muted">
        <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Access is restricted to this authenticated console. Never copy UPI IDs,
        phone numbers or provider payloads into public channels.
      </p>
    </div>
  );
}
