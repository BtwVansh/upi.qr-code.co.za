import type { Metadata } from "next";
import { PaymentRoute } from "@/components/payment-route";

export const metadata: Metadata = {
  title: "Pay using UPI",
  description:
    "Scan the UPI QR code or open a payment app to pay this UPI ID. Nothing is charged until you approve the payment inside your app.",
  robots: { index: false, follow: false, nocache: true },
};

export default function PayPage() {
  return <PaymentRoute />;
}
