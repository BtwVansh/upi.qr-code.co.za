/**
 * Input classification and validation. This module is pure so it can be used
 * by the API, the UI, and unit tests.
 */

export const MAX_INPUT_LENGTH = 320;
export const MAX_NOTE_LENGTH = 50;
export const MAX_AMOUNT = 100_000;

export type InputClassification =
  | {
      type: "PHONE";
      raw: string;
      /** Ten-digit national number, e.g. 9876543210. */
      nationalNumber: string;
      /** E.164-ish normalized value, e.g. +919876543210. */
      normalized: string;
    }
  | { type: "UPI"; raw: string; vpa: string }
  | { type: "INVALID"; raw: string; reason: "phone" | "upi" | "generic"; message: string };

const UPI_LOCAL_PART = /^[a-z0-9](?:[a-z0-9._-]{0,253}[a-z0-9])?$/;
const UPI_HANDLE = /^[a-z][a-z0-9-]{1,63}$/;

/**
 * Returns the ten-digit national number, or null.
 * Accepts common formats: 9876543210, +91 98765 43210, 09876543210,
 * 91-98765-43210.
 */
export function normalizeIndianMobile(raw: string): string | null {
  const compact = raw.trim().replace(/[\s\-().]/g, "");
  let digits = compact;

  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;

  if (digits.length === 10) {
    return /^[6-9]\d{9}$/.test(digits) ? digits : null;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    const national = digits.slice(1);
    return /^[6-9]\d{9}$/.test(national) ? national : null;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    const national = digits.slice(2);
    return /^[6-9]\d{9}$/.test(national) ? national : null;
  }
  return null;
}

export interface UpiValidation {
  valid: boolean;
  vpa?: string;
  reason?: string;
}

/**
 * UPI IDs are treated case-insensitively. The domain handle is lowercased, and
 * the local part is lowercased as well to keep blind indexes stable.
 */
export function validateUpiId(raw: string): UpiValidation {
  const value = raw.trim();
  if (!value) return { valid: false, reason: "Enter a UPI ID." };
  if (/\s/.test(value)) {
    return { valid: false, reason: "A UPI ID cannot contain spaces." };
  }

  const atCount = (value.match(/@/g) ?? []).length;
  if (atCount !== 1) {
    return {
      valid: false,
      reason: "A UPI ID must contain exactly one @, for example name@bank.",
    };
  }

  const [localRaw, handleRaw] = value.split("@");
  const local = localRaw.toLowerCase();
  const handle = handleRaw.toLowerCase();

  if (local.length < 2 || local.length > 255) {
    return { valid: false, reason: "The part before @ must be 2–255 characters." };
  }
  if (!UPI_LOCAL_PART.test(local)) {
    return {
      valid: false,
      reason:
        "The part before @ can only use letters, numbers, dots, hyphens and underscores, and must start and end with a letter or number.",
    };
  }
  if (local.includes("..")) {
    return { valid: false, reason: "A UPI ID cannot contain consecutive dots." };
  }
  if (!UPI_HANDLE.test(handle)) {
    return {
      valid: false,
      reason: "The bank handle after @ looks invalid.",
    };
  }

  return { valid: true, vpa: `${local}@${handle}` };
}

function looksLikePhoneAttempt(value: string): boolean {
  const compact = value.replace(/[\s\-().+]/g, "");
  return compact.length > 0 && /^\d+$/.test(compact) && compact.length >= 7;
}

export function classifyInput(raw: string): InputClassification {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      type: "INVALID",
      raw: trimmed,
      reason: "generic",
      message: "Enter a phone number or UPI ID to continue.",
    };
  }
  if (trimmed.length > MAX_INPUT_LENGTH) {
    return {
      type: "INVALID",
      raw: trimmed.slice(0, MAX_INPUT_LENGTH),
      reason: "generic",
      message: "That input is too long.",
    };
  }

  if (trimmed.includes("@")) {
    const upi = validateUpiId(trimmed);
    if (upi.valid && upi.vpa) {
      return { type: "UPI", raw: trimmed, vpa: upi.vpa };
    }
    return {
      type: "INVALID",
      raw: trimmed,
      reason: "upi",
      message: upi.reason ?? "That doesn't look like a valid UPI ID.",
    };
  }

  if (looksLikePhoneAttempt(trimmed)) {
    const national = normalizeIndianMobile(trimmed);
    if (national) {
      return {
        type: "PHONE",
        raw: trimmed,
        nationalNumber: national,
        normalized: `+91${national}`,
      };
    }
    const digits = trimmed.replace(/\D/g, "");
    const message =
      digits.length === 10
        ? "Indian mobile numbers must start with 6, 7, 8 or 9."
        : "Enter a valid 10-digit Indian mobile number (or a UPI ID).";
    return { type: "INVALID", raw: trimmed, reason: "phone", message };
  }

  return {
    type: "INVALID",
    raw: trimmed,
    reason: "generic",
    message:
      "That doesn't look like a phone number or UPI ID. Try 9876543210 or name@bank.",
  };
}

export interface ParsedAmount {
  /** Canonical two-decimal value, or null when no amount was provided. */
  value: string | null;
  error?: string;
}

export function parseAmount(input: unknown): ParsedAmount {
  if (input === undefined || input === null) return { value: null };
  const raw = String(input).trim();
  if (!raw) return { value: null };

  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) {
    return {
      value: null,
      error: "Enter an amount with up to 2 decimal places.",
    };
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { value: null, error: "Amount must be greater than zero." };
  }
  if (amount > MAX_AMOUNT) {
    return { value: null, error: `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString("en-IN")}.` };
  }

  return { value: amount.toFixed(2) };
}

export interface ParsedNote {
  value: string | null;
  error?: string;
}

export function parseNote(input: unknown): ParsedNote {
  if (input === undefined || input === null) return { value: null };
  const raw = String(input)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return { value: null };
  if (raw.length > MAX_NOTE_LENGTH) {
    return {
      value: null,
      error: `The note can be at most ${MAX_NOTE_LENGTH} characters.`,
    };
  }

  return { value: raw };
}
