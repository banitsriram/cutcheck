"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, useState } from "react";
import { common, introCopy } from "@/copy/common";
import { sessionState } from "@/lib/client/session-store";
import { Clip } from "../Clip";
import { LogoMark } from "../Logo";

gsap.registerPlugin(useGSAP);

/**
 * Welcome screen shown once per browser session: counter to 100 while fonts load, then it wipes up.
 * Skipped entirely under reduced motion or when already seen this session.
 */
export function Intro() {
  const root = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(true);

  useGSAP(
    () => {
      if (!root.current) return;
      // Runs before paint: returning visitors (or reduced motion) never see it.
      if (sessionState.introSeen() || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(root.current, { display: "none" });
        return;
      }
      const state = { v: 0 };
      const tl = gsap.timeline({
        onComplete: () => {
          sessionState.markIntroSeen();
          setShow(false);
        },
      });
      // Clip pops up and waves while the counter runs.
      gsap.from("[data-intro-clip]", { y: 60, autoAlpha: 0, duration: 0.7, ease: "back.out(1.7)" });
      gsap.to("[data-clip-arm]", { rotation: 18, svgOrigin: "178 196", duration: 0.28, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.timeline({ repeat: -1, repeatDelay: 1.6, delay: 0.8 }).to("[data-clip-eyes]", { scaleY: 0.12, svgOrigin: "130 116", duration: 0.09, yoyo: true, repeat: 1 });
      tl.from("[data-intro-in]", { autoAlpha: 0, y: 16, duration: 0.6, ease: "power3.out", stagger: 0.1 })
        .to(
          state,
          {
            v: 100,
            duration: 1.4,
            ease: "power2.inOut",
            onUpdate: () => {
              const v = Math.round(state.v);
              if (count.current) count.current.textContent = String(v);
              if (bar.current) bar.current.style.transform = `scaleX(${v / 100})`;
            },
          },
          0.1,
        )
        // Hold at 100 until the fonts are in, so the page underneath is ready when revealed.
        .add(() => {
          tl.pause();
          void document.fonts.ready.then(() => tl.resume());
        })
        .to(["[data-intro-clip]", "[data-intro-in]"], { autoAlpha: 0, y: -12, duration: 0.35, ease: "power2.in", stagger: 0.05 })
        .to(root.current, { yPercent: -100, duration: 0.85, ease: "expo.inOut" }, "-=0.1");
    },
    { scope: root },
  );

  if (!show) return null;
  return (
    <div
      ref={root}
      aria-hidden="true"
      className="intro-failsafe fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0e0c10] text-[#f4efe8]"
    >
      <div data-intro-clip className="relative mb-6 w-[clamp(7rem,22vw,10rem)]">
        {/* warm spotlight so Clip's dark suit reads on the night background */}
        <span className="absolute inset-[-35%] rounded-full bg-[radial-gradient(closest-side,rgba(240,122,99,0.62),rgba(243,217,207,0.2)_62%,transparent)]" />
        <Clip decorative className="relative w-full" />
      </div>
      <p data-intro-in className="font-mono text-sm uppercase tracking-[0.35em] text-[#9c9298]">
        {introCopy.welcome}
      </p>
      <p data-intro-in className="mt-5 flex items-center gap-4 font-mono text-[clamp(2.5rem,8vw,4.5rem)] font-bold uppercase tracking-[0.04em]">
        <LogoMark className="size-[0.9em]" />
        {common.appName}
      </p>
      <div data-intro-in className="absolute bottom-16 flex w-[min(28rem,80vw)] items-center gap-6">
        <span className="relative h-px flex-1 bg-white/15">
          <span ref={bar} className="absolute inset-0 origin-left bg-[#f4efe8]" style={{ transform: "scaleX(0)" }} />
        </span>
        <span ref={count} className="w-8 text-right font-mono text-base tabular-nums">
          0
        </span>
      </div>
    </div>
  );
}
