"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import "lenis/dist/lenis.css";
import { useEffect, useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger);

/** Lenis smooth scroll, driven by GSAP's ticker so ScrollTrigger never drifts. Lenis honours reduced motion itself. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    return () => gsap.ticker.remove(update);
  }, []);

  useLenis(ScrollTrigger.update);

  return (
    <ReactLenis root options={{ autoRaf: false, lerp: 0.11, anchors: true }} ref={lenisRef}>
      {children}
    </ReactLenis>
  );
}
