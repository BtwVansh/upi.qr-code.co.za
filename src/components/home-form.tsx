"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  AtSignIcon,
  LockIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import {
  DISCLAIMER_LOG_NOTE,
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_TITLE,
} from "@/lib/disclaimer";
import { buildPaymentPagePath } from "@/lib/upi";
import { validateUpiId } from "@/lib/validation";

export function HomeForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const agreeRef = useRef<HTMLButtonElement>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingVpa, setPendingVpa] = useState<string | null>(null);

  const disclaimerOpen = pendingVpa !== null;

  useEffect(() => {
    if (!disclaimerOpen) return;
    agreeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingVpa(null);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [disclaimerOpen]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = validateUpiId(input);
    if (!result.valid || !result.vpa) {
      setError(result.reason ?? "Enter a valid UPI ID to continue.");
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setPendingVpa(result.vpa);
  }

  function cancelDisclaimer() {
    setPendingVpa(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function agreeAndGenerate() {
    if (!pendingVpa) return;
    const path = buildPaymentPagePath(pendingVpa);
    setPendingVpa(null);
    router.push(path);
  }

  return (
    <div className="w-full">
      <form
        onSubmit={onSubmit}
        noValidate
        className="surface-card rounded-[28px] p-2.5 sm:p-3"
      >
        <div className="rounded-[22px] border border-line bg-[var(--elevated)] p-2 sm:p-2.5">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted">
              <AtSignIcon className="h-5 w-5" />
            </div>
            <input
              ref={inputRef}
              type="text"
              name="upiId"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter your UPI ID"
              aria-label="UPI ID"
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "form-error" : undefined}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              maxLength={320}
              className="h-[58px] w-full rounded-2xl bg-transparent py-3 pl-12 pr-4 text-[16px] font-medium text-ink outline-none placeholder:font-normal focus-visible:outline-none"
            />
          </div>

          <div className="mx-2 mt-1.5 flex items-center justify-between gap-3 pb-0.5">
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <LockIcon className="h-3 w-3" />
              No login, no UPI PIN, no OTP.
            </p>
            <span className="hidden rounded-full border border-line px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted sm:inline">
              UPI ID only
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary mt-2.5 w-full !py-[17px] text-[16px]"
        >
          Generate QR Code
          <ArrowRightIcon className="h-[18px] w-[18px]" />
        </button>
      </form>

      {error && (
        <div
          id="form-error"
          role="alert"
          aria-live="polite"
          className="mt-4 animate-pop-in rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4 text-left"
        >
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[color:var(--danger)]" />
            <p className="text-[14px] font-semibold leading-relaxed text-ink">
              {error}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          No database
        </span>
        <span className="h-1 w-1 rounded-full bg-line-strong" />
        <span>Google Pay</span>
        <span>PhonePe</span>
        <span>Paytm</span>
      </div>

      {disclaimerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
          <div
            aria-hidden="true"
            onClick={cancelDisclaimer}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="disclaimer-title"
            className="surface-card relative max-h-[90dvh] w-full max-w-lg animate-pop-in overflow-y-auto rounded-[28px] p-6 text-left sm:p-7"
          >
            <h2
              id="disclaimer-title"
              className="text-[21px] font-semibold tracking-[-0.025em]"
            >
              {DISCLAIMER_TITLE}
            </h2>

            <div className="mt-4 space-y-3 text-[13px] leading-relaxed text-muted">
              {DISCLAIMER_PARAGRAPHS.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <p className="rounded-2xl border border-line bg-[var(--elevated)] p-3 text-[12px]">
                {DISCLAIMER_LOG_NOTE}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                ref={agreeRef}
                type="button"
                onClick={agreeAndGenerate}
                className="btn-primary w-full !py-3.5 text-[14px] sm:w-auto sm:flex-1"
              >
                Agree &amp; Generate QR
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={cancelDisclaimer}
                className="btn-secondary w-full sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
