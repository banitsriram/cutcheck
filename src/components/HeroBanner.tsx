"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { bannerCopy as copy, common } from "@/copy/common";
import { Clip } from "./Clip";

gsap.registerPlugin(useGSAP);

/**
 * Opening banner: a huge wordmark with our snipped check standing in front of it like a sculpture,
 * a two-line promise bottom-left, and Clip the barber bot waving bottom-right.
 */
export function HeroBanner() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Entrance
        gsap.from("[data-banner-word]", { yPercent: 40, autoAlpha: 0, duration: 1.1, ease: "expo.out", stagger: 0.04 });
        gsap.from("[data-banner-check]", { y: 120, rotate: -14, autoAlpha: 0, duration: 1.3, ease: "expo.out", delay: 0.2 });
        gsap.from("[data-banner-clip]", { x: 80, autoAlpha: 0, duration: 1, ease: "back.out(1.6)", delay: 0.45 });
        gsap.from("[data-banner-bubble]", { scale: 0.4, autoAlpha: 0, duration: 0.6, ease: "back.out(2.2)", delay: 1.2, transformOrigin: "100% 100%" });

        // Idle life
        gsap.to("[data-banner-check]", { y: -10, rotate: 1.5, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
        // Wave a few times, rest, repeat. Blink every few seconds.
        gsap
          .timeline({ repeat: -1, repeatDelay: 2.4, delay: 1 })
          .to("[data-clip-arm]", { rotation: 18, svgOrigin: "178 196", duration: 0.3, ease: "sine.inOut", yoyo: true, repeat: 5 });
        gsap
          .timeline({ repeat: -1, repeatDelay: 3.2, delay: 2 })
          .to("[data-clip-eyes]", { scaleY: 0.12, svgOrigin: "130 116", duration: 0.09, yoyo: true, repeat: 1 });
        gsap.to("[data-clip-quiff]", { rotation: 2.5, svgOrigin: "130 70", duration: 0.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to("[data-clip-body]", { y: -3, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to("[data-clip-head]", { y: -5, rotation: -1.5, svgOrigin: "130 176", duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      aria-labelledby="banner-title"
      className="relative mt-4 overflow-hidden rounded-[2rem] bg-blush px-5 pb-6 pt-10 md:mt-6 md:px-12 md:pb-10 md:pt-14"
    >
      {/* Wordmark */}
      <h1 id="banner-title" className="relative z-0 text-center">
        <span className="sr-only">
          {common.appName}: {common.tagline}
        </span>
        <span aria-hidden="true" className="flex justify-center text-[clamp(3.6rem,15.5vw,13rem)] font-extrabold leading-[0.85] tracking-[-0.055em] text-foreground">
          {Array.from(common.appName).map((ch, i) => (
            <span key={i} data-banner-word className="inline-block">
              {ch}
            </span>
          ))}
        </span>
      </h1>

      {/* The snipped check, extruded, standing in front of the wordmark */}
      <div
        data-banner-check
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[24vw] z-10 w-[42vw] -translate-x-[60%] md:top-[12%] md:w-[min(40vw,27rem)]"
      >
        <svg viewBox="0 0 120 100" className="w-full drop-shadow-[0_30px_30px_rgba(42,19,48,0.28)]">
          {/* extrusion */}
          {[7, 6, 5, 4, 3, 2, 1].map((d) => (
            <g key={d} transform={`translate(${d * 1.1} ${d * 1.4})`}>
              <path d="M14 52 L44 80 L64 60" stroke="#7a2418" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M78 46 L104 20" stroke="#7a2418" strokeWidth="20" strokeLinecap="round" fill="none" />
            </g>
          ))}
          {/* face */}
          <path d="M14 52 L44 80 L64 60" stroke="#f07a63" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M78 46 L104 20" stroke="#f07a63" strokeWidth="20" strokeLinecap="round" fill="none" />
          {/* highlight */}
          <path d="M17 50 L43 74" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M80 41 L100 21" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* Bottom row: promise left, Clip right */}
      <div className="relative z-20 mt-[40vw] flex flex-col gap-2 md:mt-[clamp(6rem,13vw,10rem)] md:flex-row md:items-end md:justify-between md:gap-4">
        <div className="max-w-sm pb-2">
          <p className="text-[clamp(1.35rem,3vw,2.1rem)] font-extrabold leading-[1.1] tracking-tight">
            {copy.lineOne}
            <br />
            {copy.lineTwo}
          </p>
          <a href="#start" className="mt-4 flex items-center gap-2 border-t border-foreground/25 pt-3 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted hover:text-foreground">
            {copy.label} <span aria-hidden="true">↓</span>
          </a>
        </div>

        <div className="relative -mb-6 flex shrink-0 flex-col items-end self-end md:-mb-10 md:block md:w-[15rem]">
          <p
            data-banner-bubble
            className="z-10 mb-1 mr-[38vw] max-w-[13rem] rounded-2xl rounded-br-sm bg-surface px-3.5 py-2.5 text-sm font-semibold leading-snug shadow-[0_10px_30px_-12px_rgba(42,19,48,0.5)] md:absolute md:-left-40 md:top-4 md:mr-0 md:max-w-[11rem]"
          >
            {copy.bubble}
          </p>
          <div data-banner-clip className="-mt-10 w-[46vw] md:mt-0 md:w-full">
            <Clip className="w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
