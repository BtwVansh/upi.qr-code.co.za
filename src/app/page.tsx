import { HomeForm } from "@/components/home-form";
import {
  AtSignIcon,
  CheckIcon,
  InfoIcon,
  LockIcon,
  QrIcon,
  ShieldCheckIcon,
  SparkleIcon,
  WalletIcon,
} from "@/components/icons";
import { getConfig, getPublicProviderInfo } from "@/lib/config";

export const dynamic = "force-dynamic";

const steps = [
  {
    title: "Enter a phone or UPI ID",
    body: "We automatically detect the format, validate it, and look up the recipient where an authorised provider is available.",
    icon: AtSignIcon,
  },
  {
    title: "Scan or open your UPI app",
    body: "Scan the QR with Google Pay, PhonePe, Paytm, BHIM or any UPI app — or tap Open in UPI App on your phone.",
    icon: QrIcon,
  },
  {
    title: "Confirm inside your app",
    body: "Check the recipient and amount, then authorise with your UPI PIN. We never see your PIN, OTP or bank credentials.",
    icon: ShieldCheckIcon,
  },
];

export default function HomePage() {
  const providerInfo = getPublicProviderInfo();
  const config = getConfig();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <section className="mx-auto max-w-3xl pb-8 pt-8 text-center sm:pt-14">
        <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-muted">
          <SparkleIcon className="h-3.5 w-3.5 text-accent" />
          Universal UPI payments
          <span className="h-1 w-1 rounded-full bg-line-strong" />
          Built for India
        </div>

        <h1 className="mt-6 animate-fade-up text-balance text-[46px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[76px] [animation-delay:60ms]">
          Pay Anyone
          <br className="hidden sm:block" /> with <span className="text-gradient">UPI.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-md animate-fade-up text-pretty text-[16px] leading-relaxed text-muted sm:text-[17px] [animation-delay:120ms]">
          Enter a phone number or UPI ID. We&apos;ll handle the rest.
        </p>

        <div className="mx-auto mt-9 w-full max-w-[560px] animate-fade-up text-left [animation-delay:180ms]">
          <HomeForm
            resolutionAvailable={providerInfo.resolutionAvailable}
            testMode={providerInfo.testMode}
          />
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 pb-8 pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            How it works
          </p>
          <h2 className="mt-3 text-balance text-[30px] font-semibold tracking-[-0.035em] sm:text-[38px]">
            Three steps. No account.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
            Your payment is always authorised by you, inside your own UPI
            application. This site only prepares the request.
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

      <section id="privacy" className="scroll-mt-24 pb-4 pt-16">
        <div className="surface-card overflow-hidden rounded-[32px] p-6 sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <LockIcon className="h-[21px] w-[21px]" />
              </span>
              <h2 className="mt-5 text-balance text-[28px] font-semibold tracking-[-0.035em] sm:text-[34px]">
                Private by default.
              </h2>
              <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-muted">
                This is a beta utility, so we log what we need to debug it —
                and protect it. We never ask for or store payment credentials.
              </p>
              <div className="mt-5 flex items-center gap-2 text-[12px] font-medium text-muted">
                <ShieldCheckIcon className="h-4 w-4 text-[color:var(--success)]" />
                AES-256-GCM encrypted database fields
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {[
                {
                  title: "Encrypted at rest",
                  body: "Phone numbers, UPI IDs and beneficiary names are encrypted before they reach PostgreSQL.",
                },
                {
                  title: "Auto-deleted",
                  body: `Requests expire after ${config.retentionDays} day${config.retentionDays === 1 ? "" : "s"} and are removed by the retention job.`,
                },
                {
                  title: "No credentials",
                  body: "UPI PINs, OTPs and banking credentials are never requested, transmitted or stored.",
                },
                {
                  title: "Restricted access",
                  body: "Personal fields are only visible in the password-protected admin console.",
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
        </div>
      </section>

      <section className="pb-12 pt-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] border border-line bg-surface p-5">
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              <InfoIcon className="h-4 w-4 text-accent" />
              About phone-number lookup
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Turning a mobile number into a UPI ID needs the NPCI UPI Number
              facility through an authorised provider.{" "}
              {providerInfo.resolutionAvailable
                ? "This deployment has a provider configured; if a number isn't linked, you can enter the UPI ID manually."
                : "This deployment doesn't have one configured, so use a UPI ID directly. We never guess a UPI ID from a phone number."}
            </p>
          </div>
          <div className="rounded-[24px] border border-line bg-surface p-5">
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              <WalletIcon className="h-4 w-4 text-accent" />
              Verify in your app
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              A valid-looking UPI ID is not proof that it is active or belongs
              to the intended person. UPI apps display the beneficiary name —
              always check it before authorising a payment.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
