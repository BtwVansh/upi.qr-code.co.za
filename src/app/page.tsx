import { HomeForm } from "@/components/home-form";
import {
  AtSignIcon,
  CheckIcon,
  LockIcon,
  QrIcon,
  ShieldCheckIcon,
  SparkleIcon,
} from "@/components/icons";

const steps = [
  {
    title: "Enter your UPI ID",
    body: "Type the UPI ID you want to receive payments on. No phone number and no lookup service.",
    icon: AtSignIcon,
  },
  {
    title: "Generate one reusable link",
    body: "Your UPI ID is encoded in the shareable URL, so the QR page can be rebuilt from it for as long as this site stays online.",
    icon: QrIcon,
  },
  {
    title: "Share or scan to pay",
    body: "Visitors can scan the QR code or open Google Pay, PhonePe or Paytm and approve the payment themselves.",
    icon: ShieldCheckIcon,
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <section className="mx-auto max-w-3xl pb-8 pt-8 text-center sm:pt-14">
        <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-muted">
          <SparkleIcon className="h-3.5 w-3.5 text-accent" />
          UPI QR generator
          <span className="h-1 w-1 rounded-full bg-line-strong" />
          No signup
        </div>

        <h1 className="mt-6 animate-fade-up text-balance text-[46px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[76px] [animation-delay:60ms]">
          Your UPI.
          <br className="hidden sm:block" />{" "}
          <span className="text-gradient">One Link.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-md animate-fade-up text-pretty text-[16px] leading-relaxed text-muted sm:text-[17px] [animation-delay:120ms]">
          Generate your personal UPI payment QR and share it with anyone.
        </p>

        <div className="mx-auto mt-9 w-full max-w-[560px] animate-fade-up text-left [animation-delay:180ms]">
          <HomeForm />
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 pb-8 pt-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            How it works
          </p>
          <h2 className="mt-3 text-balance text-[30px] font-semibold tracking-[-0.035em] sm:text-[38px]">
            Simple by design.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
            No account, no database and no payment processing. Your UPI ID is the
            only thing needed to rebuild the QR page.
          </p>
        </div>

        <div className="mt-9 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="surface-card group relative overflow-hidden rounded-[26px] p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                    <Icon className="h-[21px] w-[21px]" />
                  </span>
                  <span className="mono text-[11px] text-muted">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  {step.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="privacy" className="scroll-mt-24 pb-12 pt-4">
        <div className="surface-card overflow-hidden rounded-[32px] p-6 sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <LockIcon className="h-[21px] w-[21px]" />
              </span>
              <h2 className="mt-5 text-balance text-[28px] font-semibold tracking-[-0.035em] sm:text-[34px]">
                Your link, your UPI ID.
              </h2>
              <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-muted">
                There is no website database. The generated URL contains your UPI
                ID so this page can be reconstructed on any device.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {[
                {
                  title: "No database",
                  body: "Your UPI ID is not saved in a website database, account or profile.",
                },
                {
                  title: "No lookup service",
                  body: "There are no phone-number lookups, third-party providers or verification APIs.",
                },
                {
                  title: "No credentials",
                  body: "UPI PINs, OTPs and banking credentials are never requested, transmitted or stored.",
                },
                {
                  title: "No automatic payment",
                  body: "Every payment is reviewed and authorised by the payer inside their own UPI app.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-line bg-[var(--elevated)] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    <h3 className="text-[13px] font-semibold">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-muted">
            Hosting providers and browsers may retain technical access logs, such
            as IP addresses, timestamps and requested URLs, as part of normal
            operation.
          </p>
        </div>
      </section>
    </div>
  );
}
