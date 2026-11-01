import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { common, landingCopy as copy } from "@/copy/common";
import { tryOnCopy } from "@/copy/journey";
import { captureCopy } from "@/copy/screens";
import { verdictCopy } from "@/copy/verdict";
import { SHOTS } from "@/lib/hair/types";
import { HeroBanner } from "@/components/HeroBanner";
import { LogoMark } from "@/components/Logo";
import { CUTS } from "@/lib/verdict/rules";

// Landing page. The first meaningful screen is two taps away.

const TONE = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  no: "bg-no-bg text-no",
} as const;
const VERDICT_LABEL = { ok: verdictCopy.labels.works, warn: verdictCopy.labels.caution, no: verdictCopy.labels.no } as const;

export default function Home() {
  const b = copy.board;
  return (
    <Reveal>
      <main className="mx-auto w-full max-w-6xl px-3 md:px-6">
        <HeroBanner />
        <div className="px-2 md:px-4">
        {/* Hero */}
        <section id="start" className="scroll-mt-28 pb-12 pt-12 md:pb-16 md:pt-20">
          <div className="eyebrow flex justify-between">
            <span>{copy.eyebrowLeft}</span>
            <span className="hidden sm:block">{copy.eyebrowRight}</span>
          </div>
          <h2 data-split className="font-display mt-8 text-[clamp(3.4rem,11vw,8.4rem)] font-light leading-[0.9] md:mt-12">
            {common.tagline}
          </h2>
          <p data-split className="font-display mt-4 text-[clamp(1.75rem,5vw,3.75rem)] italic leading-[1.05] text-accent">
            {copy.kicker}
          </p>
          <div className="mt-8 flex flex-col gap-8 md:mt-12 md:flex-row md:items-end md:justify-between">
            <p data-reveal className="max-w-xl text-lg leading-relaxed text-muted md:text-xl">
              {common.subline}
            </p>
            <div data-reveal className="flex flex-col gap-3 sm:flex-row">
              <Link href="/consent" className="btn-primary px-8">
                {common.ctaPrimary} <span aria-hidden="true">→</span>
              </Link>
              <Link href="/demo" className="btn-secondary px-8">
                {common.ctaDemo}
              </Link>
            </div>
          </div>
        </section>

        {/* Editorial board: three phone screens with handwritten margin notes */}
        <section
          data-reveal
          aria-label={b.headline}
          className="relative overflow-hidden rounded-[2rem] bg-blush px-5 pb-8 pt-8 md:px-10 lg:px-36"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <h2 className="font-display text-balance text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-none">{b.headline}</h2>
            <p className="eyebrow shrink-0 md:mt-3">
              {common.appName} / {copy.eyebrowLeft}
            </p>
          </div>

          <Note className="left-8 top-36 -rotate-6">{b.notes[0]}</Note>
          <Note className="left-10 bottom-28 rotate-3">{b.notes[1]}</Note>
          <Note className="right-8 top-40 rotate-6">{b.notes[2]}</Note>
          <Note className="right-10 bottom-28 -rotate-3">{b.notes[3]}</Note>

          <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-6">
            <Phone step={b.steps[0]}>
              <div className="grid grid-cols-3 gap-2">
                {SHOTS.map((v, i) => (
                  <figure key={v} className="flex flex-col items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- our own small SVG drawing */}
                    <img
                      src="/photos/curly-top-taper.webp"
                      alt=""
                      className={`aspect-[5/6] w-full rounded-xl object-cover object-top ${i === 1 ? "-rotate-3" : i === 2 ? "-scale-x-100 rotate-3" : ""}`}
                    />
                    <figcaption className="text-center text-[0.65rem] leading-tight text-muted">{captureCopy.shots[v].name}</figcaption>
                  </figure>
                ))}
              </div>
              <ul className="mt-3 flex flex-col divide-y divide-line text-sm">
                {b.readings.map((r) => (
                  <li key={r.name} className="flex justify-between py-2">
                    <span className="text-muted">{r.name}</span>
                    <span className="font-semibold">{r.value}</span>
                  </li>
                ))}
              </ul>
            </Phone>

            <Phone step={b.steps[1]}>
              <ul className="flex flex-col gap-2">
                {b.verdicts.map((v) => (
                  <li key={v.cut} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                    <span
                      aria-hidden="true"
                      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full font-bold ${TONE[v.tone]}`}
                    >
                      {v.mark}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{v.cut}</span>
                      <span className="text-xs text-muted">{VERDICT_LABEL[v.tone]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Phone>

            <Phone step={b.steps[2]}>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    [tryOnCopy.before, "/photos/wavy-undercut.webp"],
                    [tryOnCopy.after, "/photos/textured-crop.webp"],
                  ] as const
                ).map(([label, src]) => (
                  <figure key={label} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- our own small SVG drawing */}
                    <img src={src} alt="" className="aspect-[5/6] w-full rounded-xl object-cover object-top" />
                    <figcaption className="absolute left-1.5 top-1.5 rounded-full bg-[#2a1330]/75 px-2 py-0.5 text-[0.65rem] text-white">
                      {label}
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p aria-hidden="true" className="mt-3 rounded-full bg-accent py-2.5 text-center text-sm font-semibold text-accent-ink">
                {tryOnCopy.wearIt}
              </p>
            </Phone>
          </div>

          <p className="font-display mt-8 text-center text-sm italic text-muted">{b.caption}</p>
        </section>

        {/* Ticker: every cut we check, our mark between names */}
        <section className="pt-14 md:pt-20" aria-label={copy.marquee}>
          <p className="eyebrow mb-5">{copy.marquee}</p>
          <div className="flex overflow-hidden" data-marquee>
            {[0, 1].map((copyIndex) => (
              <p
                key={copyIndex}
                aria-hidden={copyIndex === 1 || undefined}
                className="font-display flex shrink-0 items-center whitespace-nowrap text-[clamp(2.25rem,6vw,4.5rem)] font-light"
              >
                {CUTS.map((c) => (
                  <span key={c.id} className="flex items-center">
                    {c.name}
                    <LogoMark className="mx-6 size-[0.6em] shrink-0 md:mx-8" />
                  </span>
                ))}
              </p>
            ))}
          </div>
        </section>

        {/* Lookbook: every cut we check, as a moving strip of style photos */}
        <section className="py-14 md:py-20" aria-label={copy.lookbook}>
          <div className="flex items-end justify-between gap-4">
            <p className="eyebrow">{copy.lookbook}</p>
            <p className="text-xs text-muted">{copy.photoCredit}</p>
          </div>
          <div className="-mx-5 mt-5 flex overflow-hidden md:-mx-10" data-marquee>
            {[0, 1].map((copyIndex) => (
              <ul key={copyIndex} aria-hidden={copyIndex === 1 || undefined} className="flex shrink-0 gap-4 pr-4">
                {CUTS.map((c) => (
                  <li key={c.id} className="w-40 shrink-0 md:w-52">
                    {/* eslint-disable-next-line @next/next/no-img-element -- YouCam template preview, served from our domain */}
                    <img
                      src={c.referenceImage}
                      alt={copyIndex === 0 ? c.name : ""}
                      loading="lazy"
                      className="aspect-[4/5] w-full rounded-3xl object-cover object-top"
                    />
                    <p className="font-display mt-2 text-xl">{c.name}</p>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        {/* The thinking */}
        <section id="how-it-works" className="scroll-mt-28 border-t border-line py-14 md:py-20">
          <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
            <p className="eyebrow text-accent">{copy.thinking.eyebrow}</p>
            <div>
              <h2 data-split className="font-display text-[clamp(2.25rem,5vw,4rem)] font-light leading-[1.02]">
                {copy.thinking.title}
              </h2>
              <p data-reveal className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
                {copy.thinking.body}
              </p>
            </div>
          </div>
          <ol className="mt-12 grid gap-10 border-t border-line pt-10 md:grid-cols-3 md:gap-8">
            {copy.thinking.points.map((p) => (
              <li key={p.n} data-reveal>
                <p className="text-xs font-semibold tracking-[0.18em] text-accent">{p.n}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{p.body}</p>
              </li>
            ))}
          </ol>
          <div data-reveal className="mt-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl border-l-2 border-accent pl-4 text-sm text-muted">{copy.thinking.note}</p>
            <Link href="/how-we-decide" className="font-semibold underline underline-offset-4">
              {common.ctaHowWeDecide} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        {/* Final call */}
        <section className="border-t border-line py-14 md:py-20">
          <p className="eyebrow">{copy.final.eyebrow}</p>
          <Link
            href="/consent"
            className="group mt-4 flex items-center justify-between gap-6 font-display text-[clamp(3rem,10vw,7.5rem)] font-light leading-none"
          >
            <span>{copy.final.cta}</span>
            <span
              aria-hidden="true"
              className="text-accent transition-transform duration-300 group-hover:-translate-y-2 group-hover:translate-x-2"
            >
              ↗
            </span>
          </Link>
        </section>
        </div>
      </main>
    </Reveal>
  );
}

function Phone({ step, children }: { step: { n: string; label: string; title: string; detail: string }; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-[19rem] rounded-[2.4rem] border-[7px] border-[#1a0f1d] bg-surface p-4 shadow-[0_30px_60px_-30px_rgba(42,19,48,0.55)]">
        <div aria-hidden="true" className="flex items-center justify-between px-1 text-[0.65rem] font-semibold">
          <span>9:41</span>
          <span className="h-4 w-16 rounded-full bg-[#1a0f1d]" />
          <span>●●●</span>
        </div>
        <p className="font-display mt-4 text-2xl font-semibold leading-tight">{step.title}</p>
        <p className="mb-4 text-sm text-muted">{step.detail}</p>
        {children}
      </div>
      <p className="eyebrow">
        {step.n} / {step.label}
      </p>
    </div>
  );
}

/** Handwritten margin note, only where there's room for it. */
function Note({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <p className={`font-hand absolute hidden w-28 text-[1.7rem] leading-[1.05] text-foreground/80 lg:block ${className}`}>
      {children}
    </p>
  );
}
