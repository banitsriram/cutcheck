/**
 * CutCheck mark: a check whose long stroke is snipped: "cut" and "check" in one shape.
 * Colours follow the theme (coral badge, accent-ink check). src/app/icon.svg is the same drawing.
 */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  const stroke = { stroke: "var(--accent-ink)", strokeWidth: 3.4, strokeLinecap: "round" as const, fill: "none" };
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M8 16 L13 21 L17 17" {...stroke} />
      <path d="M20.5 13.5 L24.5 9.5" {...stroke} />
    </svg>
  );
}
