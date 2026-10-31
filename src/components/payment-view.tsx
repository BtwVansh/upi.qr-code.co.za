"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  InfoIcon,
  LoaderIcon,
  LockIcon,
  QrIcon,
  ShareIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { downloadDataUrl, generateQrDataUrl } from "@/lib/qr";
import {
  PAYMENT_APPS,
  buildAppLaunchUrl,
  buildPaymentPageUrl,
  buildUpiUri,
  detectPlatform,
  type PaymentApp,
  type Platform,
} from "@/lib/upi";
import { parseAmount, parseNote } from "@/lib/validation";

interface PaymentViewProps {
  upiId: string;
  initialAmount: string;
  initialNote: string;
}

type Toast = { message: string; tone: "success" | "error" } | null;

interface AppNotice {
  app: PaymentApp;
  platform: Platform;
}

export function PaymentView({
  upiId,
  initialAmount,
  initialNote,
}: PaymentViewProps) {
  const [amount, setAmount] = useState(initialAmount);
  const [note, setNote] = useState(initialNote);
  const [active, setActive] = useState({
    amount: initialAmount,
    note: initialNote,
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [qrUpdating, setQrUpdating] = useState(false);
  const [origin, setOrigin] = useState("");
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [opening, setOpening] = useState<PaymentApp | null>(null);
  const [appNotice, setAppNotice] = useState<AppNotice | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [canShare, setCanShare] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const amountResult = parseAmount(amount);
  const noteResult = parseNote(note);

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!amountResult.error && !noteResult.error) {
        setActive({
          amount: amountResult.value ?? "",
          note: noteResult.value ?? "",
        });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    amount,
    note,
    amountResult.error,
    amountResult.value,
    noteResult.error,
    noteResult.value,
  ]);

  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [toast]);

  const upiUri = useMemo(() => {
    try {
      return buildUpiUri({
        payeeVpa: upiId,
        amount: active.amount,
        note: active.note,
      });
    } catch {
      return null;
    }
  }, [upiId, active.amount, active.note]);

  const shareUrl = useMemo(() => {
    if (!origin) return "";
    return buildPaymentPageUrl(origin, upiId, active);
  }, [origin, upiId, active]);

  useEffect(() => {
    let cancelled = false;
    if (!upiUri) return;

    setQrUpdating(true);
    generateQrDataUrl(upiUri, 1024)
      .then((dataUrl) => {
        if (cancelled) return;
        setQrDataUrl(dataUrl);
        setQrError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setQrError(true);
      })
      .finally(() => {
        if (!cancelled) setQrUpdating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [upiUri]);

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

  async function downloadQr() {
    if (!upiUri) {
      setToast({ message: "The payment QR isn't ready yet.", tone: "error" });
      return;
    }

    try {
      const dataUrl = await generateQrDataUrl(upiUri, 1024);
      const safeName = upiId.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      downloadDataUrl(dataUrl, `upi-qr-${safeName || "payment"}.png`);
      setToast({ message: "QR code downloaded", tone: "success" });
    } catch {
      setToast({
        message: "Couldn't download the QR code. Try again.",
        tone: "error",
      });
    }
  }

  async function sharePage() {
    if (!shareUrl) return;
    try {
      await navigator.share({
        title: `Pay ${upiId} with UPI`,
        text: `Scan or open this link to pay ${upiId} using UPI.`,
        url: shareUrl,
      });
    } catch (error) {
      if ((error as DOMException | undefined)?.name !== "AbortError") {
        setToast({
          message: "Couldn't open the share sheet. Copy the link instead.",
          tone: "error",
        });
      }
    }
  }

  function openApp(app: PaymentApp) {
    setAppNotice({ app, platform });

    if (platform === "desktop") return;
    if (!upiUri) {
      setToast({ message: "The payment QR isn't ready yet.", tone: "error" });
      return;
    }

    const launchUrl = buildAppLaunchUrl(
      app,
      upiUri,
      platform,
      shareUrl || undefined,
    );
    if (!launchUrl) return;

    setOpening(app);
    try {
      window.location.assign(launchUrl);
    } catch {
      setToast({
        message: "Couldn't open that app. Scan the QR code instead.",
        tone: "error",
      });
    } finally {
      window.setTimeout(() => setOpening(null), 1600);
    }
  }

  const appNoticeCopy = (() => {
    if (!appNotice) return "";
    const name =
      PAYMENT_APPS.find((app) => app.id === appNotice.app)?.name ?? "the app";

    if (appNotice.platform === "desktop") {
      return "Payment apps run on phones. Scan the QR code above with Google Pay, PhonePe, Paytm or any UPI app.";
    }
    if (appNotice.platform === "ios") {
      return `If ${name} didn't open, make sure it is installed and up to date. You can also scan the QR code above.`;
    }
    return `If ${name} didn't open, install or update it, then try again. You can also scan the QR code above.`;
  })();

  const displayShareUrl = shareUrl || `/pay/${encodeURIComponent(upiId)}`;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-10 pt-2 sm:px-8 sm:pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/" className="btn-ghost !pl-2">
          <ArrowLeftIcon className="h-4 w-4" />
          New QR
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <LockIcon className="h-3.5 w-3.5" />
          Nothing is paid automatically
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-5">
        <section className="surface-card animate-fade-up rounded-[30px] p-5 sm:p-7">
          <div className="flex items-center gap-3.5">
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] text-white shadow-[0_12px_30px_-12px_rgba(0,113,227,0.75)]">
              <QrIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                Recipient
              </p>
              <h1 className="truncate text-[24px] font-semibold tracking-[-0.035em] sm:text-[28px]">
                Pay using UPI
              </h1>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-[var(--elevated)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              UPI ID
            </p>
            <p className="mono mt-1 break-all text-[16px] font-medium text-ink sm:text-[18px]">
              {upiId}
            </p>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <div className="mb-3 flex w-full items-center justify-between px-1">
              <span className="text-[11px] font-medium text-muted">
                Scan to pay
              </span>
              {qrUpdating && (
                <span className="inline-flex items-center gap-1.5 text-[10px] text-muted">
                  <LoaderIcon className="h-3 w-3" />
                  Updating
                </span>
              )}
            </div>

            <div className="qr-frame">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`UPI payment QR code for ${upiId}`}
                  width={1024}
                  height={1024}
                  className="h-[236px] w-[236px] rounded-xl sm:h-[300px] sm:w-[300px]"
                  draggable={false}
                />
              ) : (
                <div
                  className="flex h-[236px] w-[236px] items-center justify-center rounded-xl bg-white sm:h-[300px] sm:w-[300px]"
                  aria-label="Generating QR code"
                  role="status"
                >
                  <LoaderIcon className="h-7 w-7 animate-spin text-[#0b0b0f]" />
                </div>
              )}
            </div>

            {qrError ? (
              <p className="mt-3 flex items-center gap-1.5 text-center text-[11px] font-medium text-[color:var(--danger)]">
                <AlertTriangleIcon className="h-3.5 w-3.5" />
                Couldn&apos;t draw the QR code. Refresh the page to try again.
              </p>
            ) : (
              <p className="mt-3 text-center text-[11px] text-muted">
                Scan with Google Pay, PhonePe, Paytm or any UPI app.
              </p>
            )}
            <p className="mt-1 text-center text-[10px] text-muted">
              The QR contains the UPI payment URI, not this website&apos;s URL.
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="surface-card animate-fade-up rounded-[26px] p-5 sm:p-6 [animation-delay:80ms]">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
              Payment details
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Optional. The QR code and shareable link update as you type.
            </p>

            <div className="mt-4">
              <label htmlFor="amount" className="label">
                Amount{" "}
                <span className="font-normal normal-case">(optional)</span>
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
                  Maximum ₹1,00,000 per UPI payment.
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

          <section className="surface-card animate-fade-up rounded-[26px] p-5 sm:p-6 [animation-delay:120ms]">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
              Open a payment app
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Choose one app. Nothing is charged until you review and approve the
              payment inside that app.
            </p>

            <div className="mt-4 grid gap-2">
              {PAYMENT_APPS.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => openApp(app.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line-strong bg-[var(--elevated)] px-4 py-3.5 text-left transition-colors hover:bg-accent-soft"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-[12px] font-semibold text-accent">
                      {app.name.slice(0, 1)}
                    </span>
                    <span className="text-[13px] font-semibold">
                      Open in {app.name}
                    </span>
                  </span>
                  {opening === app.id ? (
                    <LoaderIcon className="h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <ExternalLinkIcon className="h-4 w-4 shrink-0 text-muted" />
                  )}
                </button>
              ))}
            </div>

            {appNotice && (
              <div
                role="status"
                aria-live="polite"
                className="mt-3 animate-pop-in rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-[12px] font-semibold">
                    App didn&apos;t open?
                  </h3>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                  {appNoticeCopy}
                </p>
              </div>
            )}
          </section>

          <section className="surface-card animate-fade-up rounded-[26px] p-5 sm:p-6 [animation-delay:160ms]">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
              Share this QR
            </h2>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={displayShareUrl}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Shareable link"
                className="field mono min-w-0 flex-1 !py-2.5 text-[12px]"
              />
              <button
                type="button"
                onClick={() =>
                  void copyText(displayShareUrl, "Shareable link copied")
                }
                className="btn-secondary shrink-0 !px-3.5 !py-2.5 text-[12px]"
              >
                <CopyIcon className="h-4 w-4" />
                Copy
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
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
                disabled={!upiUri}
                onClick={() =>
                  upiUri && void copyText(upiUri, "UPI payment URI copied")
                }
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-line-strong bg-[var(--elevated)] px-2 py-3 text-[10.5px] font-semibold transition-colors hover:bg-accent-soft disabled:opacity-50"
              >
                <CopyIcon className="h-4 w-4" />
                Copy UPI URI
              </button>
              <button
                type="button"
                onClick={() => void downloadQr()}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-line-strong bg-[var(--elevated)] px-2 py-3 text-[10.5px] font-semibold transition-colors hover:bg-accent-soft"
              >
                <DownloadIcon className="h-4 w-4" />
                Download QR Code
              </button>
              <button
                type="button"
                onClick={() =>
                  void copyText(displayShareUrl, "Shareable link copied")
                }
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-line-strong bg-[var(--elevated)] px-2 py-3 text-[10.5px] font-semibold transition-colors hover:bg-accent-soft"
              >
                <CopyIcon className="h-4 w-4" />
                Copy Shareable Link
              </button>
            </div>

            {canShare && (
              <button
                type="button"
                onClick={() => void sharePage()}
                className="btn-primary mt-3 w-full !py-3.5 text-[14px]"
              >
                <ShareIcon className="h-4 w-4" />
                Share QR Page
              </button>
            )}

            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[var(--elevated)] p-3">
              <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--success)]" />
              <p className="text-[10.5px] leading-relaxed text-muted">
                This site can&apos;t see your UPI PIN or complete a payment.
                Authorise only inside your UPI app.
              </p>
            </div>
          </section>

          <section className="rounded-[22px] border border-line bg-surface p-4">
            <div className="flex items-start gap-2.5">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <p className="text-[11px] leading-relaxed text-muted">
                This QR page is rebuilt from its URL. No account, database or
                lookup service is used. Hosting providers and browsers may keep
                technical access logs.
              </p>
            </div>
          </section>
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
