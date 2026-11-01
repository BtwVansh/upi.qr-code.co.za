import { stripBasePath } from "@/lib/site";
import { decodeUpiIdSegment } from "@/lib/upi";
import { parseAmount, parseNote } from "@/lib/validation";

export interface PaymentRouteData {
  upiId: string;
  amount: string | null;
  note: string | null;
}

/**
 * Reads a payment page entirely from the browser URL.
 *
 * This is what makes static hosting possible: GitHub Pages serves the exported
 * 404.html for `/upi-gen/pay/<id>`, and the client reconstructs the page from
 * the pathname and query string. No storage or navigation state is involved.
 */
export function parsePaymentRoute(
  pathname: string,
  search = "",
): PaymentRouteData | null {
  const relative = stripBasePath(pathname);
  const match = relative.match(/^\/pay\/([^/]+)\/?$/);
  if (!match) return null;

  const upiId = decodeUpiIdSegment(match[1]);
  if (!upiId) return null;

  const params = new URLSearchParams(search);
  const amount = parseAmount(params.get("amount"));
  const note = parseNote(params.get("note"));

  return {
    upiId,
    amount: amount.value,
    note: note.value,
  };
}
