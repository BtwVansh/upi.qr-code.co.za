"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  InfoIcon,
  LoaderIcon,
  LockIcon,
  QrIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import {
  buildAndroidUpiIntent,
  buildPaymentPageLink,
  buildUpiUri,
} from "@/lib/upi";
import { parseAmount, parseNote } from "@/lib/validation";

type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "UNVERIFIED"
  | "NOT_FOUND"
  | "FAILED"
  | "NOT_REQUESTED";

interface PaymentViewProps {
  requestId: string;
  upiId: string;
  beneficiaryName: string | null;
  beneficiaryVerified: boolean;
  verificationStatus: VerificationStatus;
  resolutionStatus: string;
  testMode: boolean;
  createdAtLabel: string;
  expiresAtLabel: string;
  initialAmount: string;
  initialNote: string;
}

type Toast = { message: string; tone: "success" | "error" } | null;
type Platform = "android" | "ios" | "desktop";

function badgeFor(props: {
  beneficiaryVerified: boolean;
  verificationStatus: VerificationStatus;
  resolutionStatus: string;
}): { label: string; className: string } {
  if (props.beneficiaryVerified || props.verificationStatus === "VERIFIED") {
    return {
      label: "Verified",
      className:
        "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (props.verificationStatus === "NOT_FOUND") {
    return {
      label: "Not found",
      className:
        "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
    };
  }
  if (props.verificationStatus === "FAILED") {
    return {
      label: "Couldn't verify",
      className:
        "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }
  if (props.resolutionStatus === "RESOLVED") {
    return {
      label: "Resolved · unverified",
      className: "border-line bg-[var(--elevated)] text-muted",
    };
  }
  return {
    label: "Unverified",
    className: "border-line bg-[var(--elevated)] text-muted",
  };
}

function verificationCopy(props: {
  beneficiaryVerified: boolean;
  verificationStatus: VerificationStatus;
  resolutionStatus: string;
}): string {
  if (props.beneficiaryVerified || props.verificationStatus === "VERIFIED") {
    return "The beneficiary name was confirmed by the configured provider. Still check it in your UPI app.";
  }
  if (props.verificationStatus === "NOT_FOUND") {
    return "The provider could not find this UPI ID. Double-check it in your UPI app — the payment may fail.";
  }
  if (props.verificationStatus === "FAILED") {
    return "We couldn't verify this recipient with the provider. Confirm the name shown in your UPI app before paying.";
  }
  if (props.resolutionStatus === "RESOLVED") {
    return "The mobile number resolved to this UPI ID, but the beneficiary name wasn't independently verified.";
  }
  return "This recipient hasn't been independently verified. UPI apps show the beneficiary name — always check it before paying.";
}

export function PaymentView(props: PaymentViewProps) {
  const {
    requestId,
    upiId,
    beneficiaryName,
    initialAmount,
    initialNote,
  } = props;

  const [amount, setAmount] = useState(initialAmount);
  const [note, setNote] = useState(initialNote);
  const [active, setActive] = useState({
    amount: initialAmount,
    note: initialNote,
  });
  const [toast, setToast] = useState<Toast>(null);
  const [attemptedOpen, setAttemptedOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [opening, setOpening] = useState(false);

  const amountResult = parseAmount(amount);
  const noteResult = parseNote(note);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!amountResult.error && !noteResult.error) {
        setActive({
          amount: amountResult.value ?? "",
          note: noteResult.value ?? "",
        });
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [amount, note, amountResult.error, amountResult.value, noteResult.error, noteResult.value]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) setPlatform("android");
    else if (/iPad|iPhone|iPod/i.test(ua)) setPlatform("ios");
    else setPlatform("desktop");
  }, []);

  const qrSrc = useMemo(() => {
    const params = new URLSearchParams();
    if (active.amount) params.set("amount", active.amount);
    if (active.note) params.set("note", active.note);
    const query = params.toString();
    return `/api/pay/${requestId}/qr${query ? `?${query}` : ""}`;
  }, [active.amount, active.note, requestId]);

  const downloadHref = `${qrSrc}${qrSrc.includes("?") ? "&" : "?"}download=1`;

  const badge = badgeFor(props);
  const initial = beneficiaryName?.trim().charAt(0).toUpperCase() || null;

  async function copyText(text: string, message: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setToast({ message, tone: "success" });
    } catch {
      setToast({
        message: "Couldn't copy automatically. Please select and copy manually.",
        tone: "error",
      });
    }
  }

  function paymentLink(): string {
    return buildPaymentPageLink(window.location.origin, requestId, active);
  }

  function openUpiApp() {
    let uri: string;
    try {
      uri = buildUpiUri({
        payeeVpa: upiId,
        payeeName: beneficiaryName,
        amount: active.amount,
        note: active.note,
      });
    } catch {
      setToast({
        message: "Add a valid amount or note before opening your UPI app.",
        tone: "error",
      });
      return;
    }

    setAttemptedOpen(true);
    setOpening(true);

    try {
      if (platform === "android") {
        const fallback = buildPaymentPageLink(
          window.location.origin,
          requestId,
          active,
        );
        window.location.assign(buildAndroidUpiIntent(uri, fallback));
      } else {
        window.location.assign(uri);
      }
    } catch {
      setToast({
        message: "Couldn't open a UPI app. Scan the QR code instead.",
        tone: "error",
      });
    } finally {
      // The browser gives no success signal for custom schemes. Reset the
      // spinner so the fallback instructions remain usable.
      setTimeout(() => setOpening(false), 1200);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-10 pt-2 sm:px-8 sm:pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/" className="btn-ghost !pl-2">
          <ArrowLeftIcon className="h-4 w-4" />
          New payment
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <LockIcon className="h-3.5 w-3.5" />
          Secure UPI request
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-5">
        <section className="surface-card animate-fade-up rounded-[30px] p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] text-[19px] font-semibold text-white shadow-[0_12px_30px_-12px_rgba(0,113,227,0.75)]">
                {initial ? initial : <QrIcon className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                  Paying
                </p>
                <h1 className="truncate text-[24px] font-semibold tracking-[-0.035em] sm:text-[27px]">
                  {beneficiaryName || "UPI recipient"}
                </h1>
                <p className="mono mt-0.5 truncate text-[12px] text-muted sm:text-[13px]">
                  {upiId}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badge.className}`}
            >
              {props.beneficiaryVerified && (
                <CheckCircleIcon className="h-3 w-3" />
              )}
              {badge.label}
            </span>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <div className="mb-3 flex w-full items-center justify-between px-1">
              <span className="text-[11px] font-medium text-muted">
                Scan to pay
              </span>
              {props.testMode && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Test mode
                </span>
              )}
            </div>
            <div className="qr-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={qrSrc}
                src={qrSrc}
                alt={`UPI payment QR code for ${upiId}`}
                width={560}
                height={560}
                className="h-[236px] w-[236px] rounded-xl sm:h-[300px] sm:w-[300px]"
                draggable={false}
              />
            </div>
            <p className="mt-3 text-center text-[11px] text-muted">
              Contains the live UPI payment URI. Scan with any UPI app.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
            <span>Google Pay</span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <span>PhonePe</span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <span>Paytm</span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <span>BHIM</span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <span>Any UPI app</span>
          </div>

          <div className="hairline my-5" />

          <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-[var(--elevated)] p-3.5">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <p className="text-[11.5px] leading-relaxed text-muted">
              {verificationCopy(props)}
            </p>
          </div>

          <p className="mt-3 text-center text-[10px] text-muted">
            Generated {props.createdAtLabel} · Expires {props.expiresAtLabel}
          </p>
        </section>

        <div className="flex flex-col gap-4">
          <section className="surface-card animate-fade-up rounded-[26px] p-5 sm:p-6 [animation-delay:80ms]">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
              Payment details
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Optional. The QR and payment link update as you type.
            </p>

            <div className="mt-4">
              <label htmlFor="amount" className="label">
                Amount <span className="font-normal normal-case">(optional)</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[15px] font-medium text-muted">
                  ₹
                </span>
                <input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Let the payer choose"
                  className="field !pl-9"
                  aria-invalid={Boolean(amountResult.error) || undefined}
                  autoComplete="off"
                />
              </div>
              {amountResult.error ? (
                <p className="mt-1.5 text-[11px] font-medium text-[color:var(--danger)]">
                  {amountResult.error}
                </p>
              ) : (
                <p className="mt-1.5 text-[10px] text-muted">
                  Maximum ₹1,00,000 per UPI request.
                </p>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label htmlFor="note" className="label !mb-0">
                  Note <span className="font-normal normal-case">(optional)</span>
                </label>
                <span className="text-[10px] text-muted">{note.length}/50</span>
              </div>
              <input
                id="note"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Dinner, rent, split…"
                maxLength={50}
                className="field mt-2"
                aria-invalid={Boolean(noteResult.error) || undefined}
                autoComplete="off"
              />
              {noteResult.error && (
                <p className="mt-1.5 text-[11px] font-medium text-[color:var(--danger)]">
                  {noteResult.error}
                </p>
              )}
            </div>
          </section>

          <section className="surface-card animate-fade-up rounded-[26px] p-5 sm:p-6 [animation-delay:140ms]">
            <button
              type="button"
              onClick={openUpiApp}
              className="btn-primary w-full !py-[17px] text-[16px]"
            >
              {opening ? (
                <LoaderIcon className="h-[18px] w-[18px]" />
              ) : (
                <ExternalLinkIcon className="h-[18px] w-[18px]" />
              )}
              Open in UPI App
            </button>
            <p className="mt-2.5 text-center text-[10.5px] leading-relaxed text-muted">
              Your phone will offer compatible UPI apps. You confirm the payee
              and amount there.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => void copyText(upiId, "UPI ID copied")}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-line-strong bg-[var(--elevated)] px-2 py-3 text-[10.5px] font-semibold transition-colors hover:bg-accent-soft"
              >
                <CopyIcon className="h-4 w-4" />
                Copy UPI ID
              </button>
              <button
                type="button"
                onClick={() =>
                  void copyText(paymentLink(), "Payment link copied")
                }
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-line-strong bg-[var(--elevated)] px-2 py-3 text-[10.5px] font-semibold transition-colors hover:bg-accent-soft"
              >
                <CopyIcon className="h-4 w-4" />
                Copy link
              </button>
              <a
                href={downloadHref}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-line-strong bg-[var(--elevated)] px-2 py-3 text-[10.5px] font-semibold transition-colors hover:bg-accent-soft"
              >
                <DownloadIcon className="h-4 w-4" />
                Download QR
              </a>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[var(--elevated)] p-3">
              <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--success)]" />
              <p className="text-[10.5px] leading-relaxed text-muted">
                This page can&apos;t see your UPI PIN or complete a payment.
                Authorise only inside your UPI app.
              </p>
            </div>
          </section>

          {attemptedOpen && (
            <section
              role="status"
              aria-live="polite"
              className="animate-pop-in rounded-[26px] border border-amber-500/25 bg-amber-500/[0.06] p-5"
            >
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h2 className="text-[13px] font-semibold">App didn&apos;t open?</h2>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                {platform === "desktop"
                  ? "UPI apps run on phones. Scan the QR code on this page with Google Pay, PhonePe, Paytm or BHIM on your phone."
                  : platform === "ios"
                    ? "iOS only shows apps that register the upi:// scheme. Make sure a UPI app is installed and updated, then try again."
                    : "If no app chooser appeared, install or update a UPI app, then try again. You can also scan the QR code."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyText(upiId, "UPI ID copied")}
                  className="rounded-full border border-line-strong bg-[var(--elevated)] px-3 py-1.5 text-[11px] font-semibold"
                >
                  Copy UPI ID
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void copyText(paymentLink(), "Payment link copied")
                  }
                  className="rounded-full border border-line-strong bg-[var(--elevated)] px-3 py-1.5 text-[11px] font-semibold"
                >
                  Copy payment link
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-pop-in rounded-full border px-4 py-2.5 text-[12px] font-semibold shadow-lg backdrop-blur-xl ${
            toast.tone === "success"
              ? "border-emerald-500/30 bg-[var(--elevated)] text-ink"
              : "border-red-500/30 bg-[var(--elevated)] text-ink"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
