"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  AtSignIcon,
  InfoIcon,
  LoaderIcon,
  LockIcon,
  PhoneIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { classifyInput } from "@/lib/validation";

interface HomeFormProps {
  resolutionAvailable: boolean;
  testMode: boolean;
}

interface FormError {
  code: string;
  message: string;
  hint?: string;
  requestId?: string;
}

const MANUAL_FALLBACK_CODES = new Set([
  "PHONE_RESOLUTION_UNAVAILABLE",
  "UPI_NUMBER_NOT_FOUND",
  "RESOLUTION_FAILED",
]);

export function HomeForm({
  resolutionAvailable,
  testMode,
}: HomeFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const detected = useMemo(() => {
    if (!input.trim()) return null;
    const result = classifyInput(input);
    if (result.type === "PHONE") return { label: "Mobile number", type: "PHONE" as const };
    if (result.type === "UPI") return { label: "UPI ID", type: "UPI" as const };
    return null;
  }, [input]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!input.trim()) {
      setError({
        code: "VALIDATION_ERROR",
        message: "Enter a phone number or UPI ID to continue.",
      });
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            redirectTo?: string;
            error?: {
              code?: string;
              message?: string;
              hint?: string;
              requestId?: string;
            };
          }
        | null;

      if (response.ok && data?.ok && data.redirectTo) {
        router.push(data.redirectTo);
        return;
      }

      setError({
        code: data?.error?.code ?? "REQUEST_FAILED",
        message:
          data?.error?.message ??
          "We couldn't generate this payment QR. Please try again.",
        hint: data?.error?.hint,
        requestId: data?.error?.requestId,
      });
    } catch {
      setError({
        code: "NETWORK_ERROR",
        message:
          "We couldn't reach the server. Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  function switchToManual() {
    setManualMode(true);
    setInput("");
    setError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const canFallback = error ? MANUAL_FALLBACK_CODES.has(error.code) : false;

  return (
    <div className="w-full">
      {!resolutionAvailable && (
        <div
          className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5 text-left"
          role="note"
        >
          <InfoIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[13px] leading-relaxed text-ink">
            <span className="font-semibold text-ink">
              Phone-number lookup is unavailable here.
            </span>{" "}
            Enter the recipient&apos;s UPI ID directly to generate a payment QR.
            We never guess a UPI ID from a mobile number.
          </p>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        noValidate
        className="surface-card rounded-[28px] p-2.5 sm:p-3"
      >
        <div className="rounded-[22px] border border-line bg-[var(--elevated)] p-2 sm:p-2.5">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted">
              {detected?.type === "UPI" ? (
                <AtSignIcon className="h-5 w-5" />
              ) : (
                <PhoneIcon className="h-5 w-5" />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              name="input"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (error) setError(null);
              }}
              placeholder={
                manualMode
                  ? "Enter a UPI ID, e.g. name@bank"
                  : "Enter phone number or UPI ID"
              }
              aria-label="Phone number or UPI ID"
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "form-error" : undefined}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              maxLength={320}
              className={`h-[58px] w-full rounded-2xl bg-transparent py-3 pl-12 text-[16px] font-medium text-ink outline-none placeholder:font-normal focus-visible:outline-none ${
                detected ? "pr-28" : "pr-4"
              }`}
            />
            {detected && (
              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                  {detected.type === "UPI" ? (
                    <AtSignIcon className="h-3 w-3" />
                  ) : (
                    <PhoneIcon className="h-3 w-3" />
                  )}
                  {detected.label}
                </span>
              </span>
            )}
          </div>

          <div className="mx-2 mt-1.5 flex items-center justify-between gap-3 pb-0.5">
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <LockIcon className="h-3 w-3" />
              No login, no UPI PIN, no OTP.
            </p>
            {testMode && (
              <span className="rounded-full border border-line px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
                Test mode
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary mt-2.5 w-full !py-[17px] text-[16px]"
        >
          {loading ? (
            <>
              <LoaderIcon className="h-[18px] w-[18px]" />
              Generating payment QR…
            </>
          ) : (
            <>
              Generate Payment QR
              <ArrowRightIcon className="h-[18px] w-[18px]" />
            </>
          )}
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
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-relaxed text-ink">
                {error.message}
              </p>
              {error.hint && (
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  {error.hint}
                </p>
              )}
              {canFallback && (
                <button
                  type="button"
                  onClick={switchToManual}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-[var(--elevated)] px-3.5 py-2 text-[12px] font-semibold text-ink transition-colors hover:bg-accent-soft"
                >
                  Enter a UPI ID instead
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              )}
              {error.requestId && (
                <p className="mono mt-2.5 truncate text-[10px] text-muted">
                  Ref {error.requestId}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          Encrypted submissions
        </span>
        <span className="h-1 w-1 rounded-full bg-line-strong" />
        <span>Google Pay</span>
        <span>PhonePe</span>
        <span>Paytm</span>
        <span>BHIM</span>
      </div>
    </div>
  );
}
