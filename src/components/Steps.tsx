import { steps } from "@/copy/screens";

/** Journey indicator, numbered like the reference: 01 / Scan → 05 / Keep it. */
export function Steps({ current }: { current: number }) {
  return (
    <nav aria-label="Progress" className="mb-10">
      <p className="eyebrow mb-3 text-accent">
        {String(current + 1).padStart(2, "0")} / {steps[current]}
      </p>
      <ol className="flex gap-1.5">
        {steps.map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li key={label} className="flex-1" aria-current={state === "current" ? "step" : undefined}>
              <span
                className={`block h-[3px] rounded-full ${state === "todo" ? "bg-line" : state === "current" ? "bg-accent" : "bg-foreground/60"}`}
                aria-hidden="true"
              />
              <span className={`mt-2 block text-[0.7rem] ${state === "current" ? "font-semibold text-foreground" : "text-muted"}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
