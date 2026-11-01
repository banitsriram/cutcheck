"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/**
 * Motion for everything inside it, opted in with data attributes:
 *   data-split   headline: words rise and fade in (SplitText keeps an aria-label)
 *   data-reveal  fades up as it scrolls into view (batched, staggered)
 *   data-marquee an endless horizontal loop of its children (two identical copies)
 * Nothing moves under prefers-reduced-motion.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const splits = gsap.utils.toArray<HTMLElement>("[data-split]").map((el) =>
          SplitText.create(el, {
            type: "words",
            autoSplit: true,
            // aria-label is only allowed on headings; plain word spans read fine elsewhere.
            aria: /^H[1-6]$/.test(el.tagName) ? "auto" : "none",
            onSplit: (self) =>
              gsap.from(self.words, { yPercent: 60, autoAlpha: 0, duration: 0.9, ease: "expo.out", stagger: 0.045, delay: 0.05 }),
          }),
        );

        const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]");
        // Opacity only (not visibility), so content below the fold stays clickable and in the Tab order.
        if (reveals.length) gsap.set(reveals, { opacity: 0, y: 28 });
        ScrollTrigger.batch(reveals, {
          start: "top 90%",
          once: true,
          onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 }),
        });

        gsap.utils.toArray<HTMLElement>("[data-marquee]").forEach((track) => {
          gsap.to(track.children, { xPercent: -100, duration: 40, ease: "none", repeat: -1 });
        });

        return () => splits.forEach((s) => s.revert());
      });
    },
    { scope },
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
