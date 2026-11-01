import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces, Manrope } from "next/font/google";
import { connection } from "next/server";
import { DemoBanner } from "@/components/DemoBanner";
import { Intro } from "@/components/motion/Intro";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { common } from "@/copy/common";
import "./globals.css";

// Self-hosted at build time (font-src 'self'); no request ever goes to Google.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz", "SOFT"] });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  title: `${common.appName}: ${common.tagline}`,
  description: common.subline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#14111a" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render per request so Next.js can put this request's CSP nonce on its scripts.
  await connection();
  return (
    <html lang="en" className={`h-full antialiased ${manrope.variable} ${fraunces.variable} ${caveat.variable}`}>
      <body className="flex min-h-full flex-col">
        <SmoothScroll>
          <Intro />
          <DemoBanner />
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </SmoothScroll>
      </body>
    </html>
  );
}
