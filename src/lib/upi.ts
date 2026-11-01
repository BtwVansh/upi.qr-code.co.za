import { withBasePath } from "@/lib/site";
import {
  MAX_NOTE_LENGTH,
  parseAmount,
  parseNote,
  validateUpiId,
} from "@/lib/validation";

export type Platform = "android" | "ios" | "desktop";
export type PaymentApp = "gpay" | "phonepe" | "paytm";

export interface UpiUriInput {
  payeeVpa: string;
  amount?: string | null;
  note?: string | null;
}

export interface PaymentAppDefinition {
  id: PaymentApp;
  name: string;
  /** Android package that receives the app-specific UPI intent. */
  androidPackage: string;
  /** iOS URL scheme prefix. The UPI path/query is appended to it. */
  iosScheme: string;
}

/**
 * App-specific launch targets. Each app gets its own registered package or
 * scheme; no generic Android chooser is used.
 *
 * - Google Pay iOS: `gpay://` is documented by Google at
 *   https://developers.google.com/pay/india/api/ios/in-app-payments
 * - PhonePe and Paytm use their own app URL schemes. The Android packages are
 *   the published Play Store package names.
 */
export const PAYMENT_APPS: readonly PaymentAppDefinition[] = [
  {
    id: "gpay",
    name: "Google Pay",
    androidPackage: "com.google.android.apps.nbu.paisa.user",
    iosScheme: "gpay://upi/",
  },
  {
    id: "phonepe",
    name: "PhonePe",
    androidPackage: "com.phonepe.app",
    iosScheme: "phonepe://",
  },
  {
    id: "paytm",
    name: "Paytm",
    androidPackage: "net.one97.paytm",
    iosScheme: "paytmmp://",
  },
];

/**
 * RFC 3986-safe percent encoding. encodeURIComponent leaves a few characters
 * (`!`, `'`, `(`, `)`, `*`) untouched; UPI parameters are encoded fully so the
 * payload is unambiguous, including `@` as `%40`.
 */
function encodeParam(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Builds a standard UPI payment URI / QR payload:
 *   upi://pay?pa=recipient%40upi&cu=INR
 *
 * Optional amount (`am`) and note (`tn`) are appended only when supplied.
 * The QR code always contains this payment URI, never the website URL.
 */
export function buildUpiUri(input: UpiUriInput): string {
  const validation = validateUpiId(input.payeeVpa);
  if (!validation.valid || !validation.vpa) {
    throw new Error("Cannot build a UPI URI for an invalid UPI ID.");
  }

  const params: Array<[string, string]> = [["pa", validation.vpa]];

  const amount = parseAmount(input.amount);
  if (amount.error) throw new Error(amount.error);
  if (amount.value) params.push(["am", amount.value]);

  params.push(["cu", "INR"]);

  const note = parseNote(input.note);
  if (note.error) throw new Error(note.error);
  if (note.value) params.push(["tn", note.value.slice(0, MAX_NOTE_LENGTH)]);

  return `upi://pay?${params
    .map(([key, value]) => `${key}=${encodeParam(value)}`)
    .join("&")}`;
}

/** Returns the canonical UPI ID from a route segment, or null if invalid. */
export function decodeUpiIdSegment(raw: string): string | null {
  if (!raw) return null;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  const validation = validateUpiId(decoded);
  return validation.valid && validation.vpa ? validation.vpa : null;
}

function appendPaymentQuery(
  params: URLSearchParams,
  options?: { amount?: string | null; note?: string | null },
): void {
  const amount = parseAmount(options?.amount);
  if (amount.value) params.set("amount", amount.value);
  const note = parseNote(options?.note);
  if (note.value) params.set("note", note.value);
}

/**
 * Relative path for the reusable QR page, e.g. `/pay/name%40bank`.
 * The UPI ID lives in the path so the page can be rebuilt from the URL alone.
 */
export function buildPaymentPagePath(
  upiId: string,
  options?: { amount?: string | null; note?: string | null },
): string {
  const validation = validateUpiId(upiId);
  if (!validation.valid || !validation.vpa) {
    throw new Error("Cannot build a payment page for an invalid UPI ID.");
  }

  const params = new URLSearchParams();
  appendPaymentQuery(params, options);
  const query = params.toString();
  return `/pay/${encodeParam(validation.vpa)}${query ? `?${query}` : ""}`;
}

/**
 * Absolute shareable URL for the reusable QR page, including the deployment
 * base path (for example `https://example.com/upi-gen/pay/name%40bank`).
 */
export function buildPaymentPageUrl(
  origin: string,
  upiId: string,
  options?: { amount?: string | null; note?: string | null },
): string {
  return new URL(withBasePath(buildPaymentPagePath(upiId, options)), origin).toString();
}

/** Android intent targeting one specific payment app. */
export function buildAndroidAppIntent(
  upiUri: string,
  androidPackage: string,
  fallbackUrl?: string,
): string {
  if (!upiUri.startsWith("upi://")) {
    throw new Error("Android intents can only be built from a upi:// URI.");
  }
  if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(androidPackage)) {
    throw new Error("Invalid Android package name.");
  }

  const pathAndQuery = upiUri.slice("upi://".length);
  const fallback =
    fallbackUrl && /^https?:\/\//i.test(fallbackUrl)
      ? `S.browser_fallback_url=${encodeParam(fallbackUrl)};`
      : "";

  return (
    `intent://${pathAndQuery}#Intent;scheme=upi;` +
    `package=${androidPackage};` +
    `action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    `${fallback}end`
  );
}

/**
 * App-specific launch URL for the current platform.
 * Returns null on desktop, where the QR code is the intended flow.
 */
export function buildAppLaunchUrl(
  app: PaymentApp,
  upiUri: string,
  platform: Platform,
  fallbackUrl?: string,
): string | null {
  const definition = PAYMENT_APPS.find((item) => item.id === app);
  if (!definition) throw new Error("Unknown payment app.");

  if (platform === "android") {
    return buildAndroidAppIntent(
      upiUri,
      definition.androidPackage,
      fallbackUrl,
    );
  }

  if (platform === "ios") {
    // UPI URI:      upi://pay?pa=...
    // Google Pay:   gpay://upi/pay?pa=...
    // PhonePe:      phonepe://pay?pa=...
    // Paytm:        paytmmp://pay?pa=...
    return `${definition.iosScheme}${upiUri.slice("upi://".length)}`;
  }

  return null;
}

/** Client-side platform detection from the browser user agent. */
export function detectPlatform(userAgent: string): Platform {
  if (/android/i.test(userAgent)) return "android";
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
  return "desktop";
}
