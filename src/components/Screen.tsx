import type { ReactNode } from "react";
import { Reveal } from "./motion/Reveal";
import { Steps } from "./Steps";

/** Mobile-first column used by every flow screen. `wide` lets tables breathe on laptops. */
export function Screen({
  step,
  title,
  intro,
  wide,
  children,
}: {
  step?: number;
  title: string;
  intro?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Reveal>
      <main className={`mx-auto w-full px-5 pb-16 pt-8 ${wide ? "max-w-5xl md:px-10" : "max-w-lg"}`}>
        {step !== undefined && <Steps current={step} />}
        <h1 data-split className="font-display text-[2.4rem] font-normal leading-[1.02] md:text-5xl">
          {title}
        </h1>
        {intro && <p className="mt-3 text-lg leading-relaxed text-muted">{intro}</p>}
        <div className="mt-8">{children}</div>
      </main>
    </Reveal>
  );
}
