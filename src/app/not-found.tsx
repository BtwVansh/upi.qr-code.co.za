import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeftIcon, QrIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Payment link not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 pb-16 pt-16 text-center sm:pt-24">
      <div className="qr-frame flex h-24 w-24 items-center justify-center opacity-80">
        <QrIcon className="h-10 w-10 text-[#0b0b0f]" />
      </div>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
        404 · Link unavailable
      </p>
      <h1 className="mt-3 text-balance text-[32px] font-semibold leading-tight tracking-[-0.04em] sm:text-[40px]">
        This payment link isn&apos;t available.
      </h1>
      <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-muted">
        It may be mistyped or expired. Payment requests are automatically
        deleted after the retention period. Ask the sender for a new link.
      </p>
      <Link href="/" className="btn-primary mt-7 !px-5 !py-3">
        <ArrowLeftIcon className="h-4 w-4" />
        Create a new payment QR
      </Link>
      <p className="mt-6 text-[11px] text-muted">
        Never share your UPI PIN or OTP with anyone.
      </p>
    </div>
  );
}
