import { ArrowLeftIcon, QrIcon } from "@/components/icons";
import { withBasePath } from "@/lib/site";

export function NotFoundView() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 pb-16 pt-16 text-center sm:pt-24">
      <div className="qr-frame flex h-24 w-24 items-center justify-center opacity-80">
        <QrIcon className="h-10 w-10 text-[#0b0b0f]" />
      </div>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
        404 · Link unavailable
      </p>
      <h1 className="mt-3 text-balance text-[32px] font-semibold leading-tight tracking-[-0.04em] sm:text-[40px]">
        This UPI link isn&apos;t valid.
      </h1>
      <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-muted">
        The UPI ID in this URL may be mistyped or incomplete. Ask the sender for
        the link again, or generate a new QR code.
      </p>
      <a href={withBasePath("/")} className="btn-primary mt-7 !px-5 !py-3">
        <ArrowLeftIcon className="h-4 w-4" />
        Create a new UPI QR
      </a>
      <p className="mt-6 text-[11px] text-muted">
        Never share your UPI PIN or OTP with anyone.
      </p>
    </div>
  );
}
