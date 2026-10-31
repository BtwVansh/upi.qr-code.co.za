import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaymentView } from "@/components/payment-view";
import { decodeUpiIdSegment } from "@/lib/upi";
import { parseAmount, parseNote } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Pay using UPI",
  description:
    "Scan the UPI QR code or open a payment app to pay this UPI ID. Nothing is charged until you approve the payment inside your app.",
  robots: { index: false, follow: false, nocache: true },
};

type Params = Promise<{ upiId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { upiId } = await params;
  const vpa = decodeUpiIdSegment(upiId);
  if (!vpa) notFound();

  const query = await searchParams;
  const amount = parseAmount(first(query.amount));
  const note = parseNote(first(query.note));

  return (
    <PaymentView
      upiId={vpa}
      initialAmount={amount.value ?? ""}
      initialNote={note.value ?? ""}
    />
  );
}
