import { LockIcon } from "@/components/icons";
import { withBasePath } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-10 pt-16 sm:px-8">
      <div className="hairline mb-7" />
      <div className="flex flex-col gap-5 text-[12px] leading-relaxed text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5">
            <LockIcon className="h-3.5 w-3.5" />
            We never ask for your UPI PIN, OTP or banking credentials.
          </p>
          <p>
            QR pages are rebuilt from their URLs. No account or website database
            is used.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            href={withBasePath("/#how-it-works")}
            className="transition-colors hover:text-ink"
          >
            How it works
          </a>
          <a
            href={withBasePath("/#privacy")}
            className="transition-colors hover:text-ink"
          >
            Privacy
          </a>
        </nav>
      </div>
      <p className="mt-6 text-[11px] text-muted">
        UPI Pay QR is an independent utility. UPI is operated by NPCI. Payments
        are authorised only inside your UPI application.
      </p>
    </footer>
  );
}
