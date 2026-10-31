import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getConfig } from "@/lib/config";
import { AuroraBackground } from "@/components/aurora-background";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeScript } from "@/components/theme-script";

export const metadata: Metadata = {
  title: {
    default: "UPI Pay QR — Pay Anyone with UPI",
    template: "%s · UPI Pay QR",
  },
  description:
    "Enter an Indian mobile number or UPI ID to generate a UPI payment QR code and open any UPI app. A simple, private beta utility.",
  applicationName: "UPI Pay QR",
  keywords: ["UPI", "UPI QR", "payment link", "India", "UPI ID", "phone number"],
  openGraph: {
    title: "UPI Pay QR — Pay Anyone with UPI",
    description:
      "Enter a phone number or UPI ID. We'll handle the rest. Generate a scannable UPI QR in seconds.",
    type: "website",
    locale: "en_IN",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = getConfig();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeScript />
        <AuroraBackground />
        <div className="relative flex min-h-dvh flex-col">
          <SiteHeader />
          <main className="relative z-10 flex-1">{children}</main>
          <SiteFooter retentionDays={config.retentionDays} />
        </div>
      </body>
    </html>
  );
}
