/**
 * Pure UPI validation and optional payment-detail parsing.
 *
 * Nothing here talks to a server, a database or a lookup provider. Every value
 * is validated in the browser before a QR code or shareable URL is created.
 */

export const MAX_UPI_ID_LENGTH = 320;
export const MAX_NOTE_LENGTH = 50;
export const MAX_AMOUNT = 100_000;

const UPI_LOCAL_PART = /^[a-z0-9](?:[a-z0-9._-]{0,253}[a-z0-9])?$/;
const UPI_HANDLE = /^[a-z][a-z0-9-]{1,63}$/;

export interface UpiValidation {
  valid: boolean;
  /** Lowercase, canonical UPI ID when valid. */
  vpa?: string;
  reason?: string;
}

/**
 * Validates a UPI ID (VPA). UPI IDs are treated case-insensitively, so the
 * canonical value is lowercased. This keeps the URL, QR payload and copied
 * value consistent.
 */
export function validateUpiId(raw: string): UpiValidation {
  const value = raw.trim();

  if (!value) return { valid: false, reason: "Enter a UPI ID." };
  if (value.length > MAX_UPI_ID_LENGTH) {
    return { valid: false, reason: "That UPI ID is too long." };
  }
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
    return { valid: false, reason: "The bank handle after @ looks invalid." };
  }

  return { valid: true, vpa: `${local}@${handle}` };
}

/** Convenience helper for UI state. */
export function isValidUpiId(raw: string): boolean {
  return validateUpiId(raw).valid;
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
    return {
      value: null,
      error: `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString("en-IN")}.`,
    };
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
