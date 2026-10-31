import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuroraBackground } from "@/components/aurora-background";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeScript } from "@/components/theme-script";

export const metadata: Metadata = {
  title: {
    default: "UPI Pay QR — Your UPI. One Link.",
    template: "%s · UPI Pay QR",
  },
  description:
    "Generate a UPI payment QR code and a permanent shareable link from your UPI ID. Frontend-only, no signup and no database.",
  applicationName: "UPI Pay QR",
  keywords: ["UPI", "UPI QR", "UPI ID", "payment link", "share UPI", "India"],
  openGraph: {
    title: "UPI Pay QR — Your UPI. One Link.",
    description:
      "Generate your personal UPI payment QR and share it with anyone. No signup and no database.",
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeScript />
        <AuroraBackground />
        <div className="relative flex min-h-dvh flex-col">
          <SiteHeader />
          <main className="relative z-10 flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
