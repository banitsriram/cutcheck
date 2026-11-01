import Link from "next/link";
import { common } from "@/copy/common";
import { LogoMark } from "./Logo";

/** Floating frosted-glass bar, inset from the edges and pinned while the page scrolls. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 md:px-6 md:pt-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-surface/70 py-2 pl-3 pr-2 shadow-[0_12px_40px_-20px_rgba(42,19,48,0.45)] backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-surface/95 md:pl-4">
        <Link href="/" aria-label={`${common.appName} home`} className="group flex items-center gap-2.5 rounded-xl">
          <LogoMark className="size-9 transition-transform duration-300 group-hover:-rotate-6" />
          <span aria-hidden="true" className="text-sm font-extrabold uppercase tracking-[0.22em]">
            {common.appName}
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {common.nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-4 py-2 text-[0.95rem] text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/consent" className="btn-primary min-h-11 px-5 text-sm">
          {common.navCta}
        </Link>
      </div>
    </header>
  );
}
