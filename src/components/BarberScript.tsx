"use client";

import { useState } from "react";
import { barberCopy } from "@/copy/verdict";
import type { HairType } from "@/lib/hair/types";

/** "What to tell your barber": the cut's notes as plain speech, plus a tip for this hair type. */
export function BarberScript({
  name,
  barber,
  type,
}: {
  name: string;
  barber: { top: string; sides: string; notes: string };
  type?: HairType;
}) {
  const [copied, setCopied] = useState(false);
  const lines = [...barberCopy.lines(name, barber.top, barber.sides, barber.notes), ...(type ? [barberCopy.typeTip[type]] : [])];

  async function copy() {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the text is on screen to read out anyway.
    }
  }

  return (
    <section className="rounded-3xl bg-blush p-5" aria-label={barberCopy.title}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold">{barberCopy.title}</p>
          <p className="text-sm text-muted">{barberCopy.intro}</p>
        </div>
        <button type="button" onClick={copy} className="btn-secondary min-h-10 shrink-0 px-4 text-sm" aria-live="polite">
          {copied ? barberCopy.copied : barberCopy.copy}
        </button>
      </div>
      <ol className="mt-4 flex flex-col gap-2">
        {lines.map((l) => (
          <li key={l} className="rounded-2xl rounded-tl-sm bg-surface px-4 py-2.5 leading-snug">
            {l}
          </li>
        ))}
      </ol>
    </section>
  );
}
