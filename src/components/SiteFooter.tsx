import Link from "next/link";
import { common, footerCopy as f } from "@/copy/common";
import { deleteCopy, salonsCopy } from "@/copy/journey";

// Grid-lined coral block (fixed colours, same in both themes): headline left, links and a big mark
// right. Ink on coral is 6.8:1. Compact on phones.
const INK = "#1a0f1d";

export function SiteFooter() {
  return (
    <footer className="px-3 pb-3 pt-12 md:px-6 md:pb-6 md:pt-16">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[1.5rem] bg-[#f07a63] text-[#1a0f1d] md:grid-cols-[5fr_7fr] md:rounded-[1.75rem]">
        {/* Left: wordmark, headline, small print */}
        <div className="flex flex-col justify-between gap-5 p-5 md:gap-10 md:border-r md:border-[#1a0f1d]/70 md:p-8">
          <div>
            <p className="flex items-center gap-2 font-extrabold tracking-tight md:text-lg">
              <FooterMark className="size-5 md:size-6" />
              {common.appName}.
            </p>
            <p className="mt-3 text-[clamp(1.9rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.03em] md:mt-6">{f.headline}</p>
          </div>
          <div className="flex flex-col gap-0.5 text-sm font-medium md:text-[0.95rem]">
            <p>{common.footerDisclaimer}</p>
            <p>{common.footerBuiltWith}</p>
          </div>
        </div>

        {/* Right: hairline grid */}
        <div className="grid border-t border-[#1a0f1d]/70 md:grid-rows-[auto_1fr_auto] md:border-t-0">
          <div className="flex items-center justify-between gap-2 border-b border-[#1a0f1d]/70 p-3">
            <p className="pl-1 text-xs font-bold uppercase tracking-[0.08em]">{f.labelRight}</p>
            <Link href="/consent" className="flex min-h-11 items-center gap-6 bg-[#1a0f1d] px-4 text-sm font-semibold text-white md:gap-10">
              {common.navCta} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="grid grid-cols-[1fr_auto] border-b border-[#1a0f1d]/70">
            <ul className="flex flex-col justify-center gap-1.5 border-r border-[#1a0f1d]/70 p-4 text-sm font-semibold md:gap-2 md:text-[0.95rem]">
              {[
                ["/how-we-decide", common.navRules],
                ["/privacy", common.privacyLink],
                ["/delete", deleteCopy.link],
                ["/for-salons", salonsCopy.title],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="underline-offset-4 hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-center p-4 md:p-8">
              <FooterMark className="size-20 md:size-48" />
            </div>
          </div>
          <p className="p-4 text-xs font-medium md:text-sm">{common.footerPrivacy}</p>
        </div>
      </div>
    </footer>
  );
}

/** The CutCheck mark as solid ink: the check with its snip, no badge. */
function FooterMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path d="M5 16.5 L12.5 24 L18 18.5" stroke={INK} strokeWidth="5" strokeLinecap="square" fill="none" />
      <path d="M22 14.5 L28 8.5" stroke={INK} strokeWidth="5" strokeLinecap="square" fill="none" />
    </svg>
  );
}
