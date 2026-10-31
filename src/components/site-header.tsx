import Link from "next/link";
import { QrIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/" className="group flex items-center gap-2.5 rounded-2xl">
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] text-white shadow-[0_8px_20px_-8px_rgba(0,113,227,0.8)] transition-transform duration-300 group-hover:scale-105">
          <QrIcon className="h-[18px] w-[18px]" />
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-[16px] font-semibold tracking-[-0.02em]">
            UPI Pay
          </span>
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
            QR
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-muted sm:inline-flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#30d158] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#28b84c]" />
          </span>
          Google Pay · PhonePe · Paytm
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
