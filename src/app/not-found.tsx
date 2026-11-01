import type { Metadata } from "next";
import { PaymentRoute } from "@/components/payment-route";

export const metadata: Metadata = {
  title: "Payment link not found",
  robots: { index: false, follow: false },
};

/**
 * GitHub Pages serves this exported 404 page for `/upi-gen/pay/<upiId>`.
 * PaymentRoute checks the actual browser path and renders the payment page
 * when it contains a valid UPI ID, or the 404 notice otherwise.
 */
export default function NotFound() {
  return <PaymentRoute />;
}
