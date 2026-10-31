import {
  MAX_NOTE_LENGTH,
  parseAmount,
  parseNote,
  validateUpiId,
} from "@/lib/validation";

export interface UpiUriInput {
  payeeVpa: string;
  payeeName?: string | null;
  amount?: string | null;
  note?: string | null;
}

/**
 * Builds a standard UPI deep link / QR payload:
 *   upi://pay?pa=recipient@upi&pn=Recipient%20Name&cu=INR
 *
 * Values are percent-encoded with %20 for spaces (not "+"), which is the
 * interoperable format accepted by Google Pay, PhonePe, Paytm, BHIM and other
 * UPI applications.
 */
export function buildUpiUri(input: UpiUriInput): string {
  const validation = validateUpiId(input.payeeVpa);
  if (!validation.valid || !validation.vpa) {
    throw new Error("Cannot build a UPI URI for an invalid UPI ID.");
  }

  const params: Array<[string, string]> = [["pa", validation.vpa]];

  const name = (input.payeeName ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 99);
  if (name) params.push(["pn", name]);

  const amount = parseAmount(input.amount);
  if (amount.error) throw new Error(amount.error);
  if (amount.value) params.push(["am", amount.value]);

  params.push(["cu", "INR"]);

  const note = parseNote(input.note);
  if (note.error) throw new Error(note.error);
  if (note.value) params.push(["tn", note.value.slice(0, MAX_NOTE_LENGTH)]);

  return `upi://pay?${params
    .map(
      ([key, value]) =>
        `${key}=${encodeURIComponent(value).replace(/%40/g, "@")}`,
    )
    .join("&")}`;
}

/**
 * Android chooser intent. Omitting "package" lets the OS show every installed
 * app that can handle the UPI scheme instead of hardcoding one payment app.
 * `browser_fallback_url` returns the user to the payment page if no app exists.
 */
export function buildAndroidUpiIntent(
  upiUri: string,
  fallbackUrl?: string,
): string {
  if (!upiUri.startsWith("upi://")) {
    throw new Error("Android intents can only be built from a upi:// URI.");
  }

  const pathAndQuery = upiUri.slice("upi://".length);
  const fallback =
    fallbackUrl && /^https?:\/\//i.test(fallbackUrl)
      ? `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};`
      : "";

  return (
    `intent://${pathAndQuery}#Intent;scheme=upi;` +
    `action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    `${fallback}end`
  );
}

/** Shareable link back to this recipient's payment page. */
export function buildPaymentPageLink(
  origin: string,
  requestId: string,
  options?: { amount?: string | null; note?: string | null },
): string {
  const url = new URL(`/pay/${encodeURIComponent(requestId)}`, origin);
  const amount = parseAmount(options?.amount);
  if (amount.value) url.searchParams.set("amount", amount.value);
  const note = parseNote(options?.note);
  if (note.value) url.searchParams.set("note", note.value);
  return url.toString();
}
