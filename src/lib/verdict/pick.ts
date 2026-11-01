import type { HairType } from "../hair/types";
import type { Verdict } from "./engine";

// "Our pick for you" (deterministic, like the verdicts): among the cuts that work, prefer one made
// for this hair type, ready now, easy to wear, and on trend. Every point it scores becomes a reason.

export type PickReason =
  | { kind: "tailored"; type: HairType }
  | { kind: "universal" }
  | { kind: "suits"; type: HairType }
  | { kind: "readyNow" }
  | { kind: "growFirst" }
  | { kind: "products" }
  | { kind: "styling"; minutes: number }
  | { kind: "trims"; weeks: number }
  | { kind: "trend" };

export interface PickCut {
  id: string;
  types: readonly HairType[];
  trend2026: boolean;
  trimWeeks: number;
  dailyMinutes: number;
}

export interface Pick {
  cutId: string;
  reasons: PickReason[];
}

export function pickBest(verdicts: readonly Verdict[], cuts: readonly PickCut[], type: HairType | undefined): Pick[] {
  const byId = new Map(cuts.map((c) => [c.id, c]));
  const scored = verdicts
    .filter((v) => v.verdict === "works" || v.verdict === "caution")
    .flatMap((v) => {
      const cut = byId.get(v.cutId);
      if (!cut) return [];
      const tailored = !!type && cut.types.includes(type) && cut.types.length <= 2;
      const growth = v.concerns.includes("growth");
      const score =
        (v.verdict === "works" ? 4 : 0) +
        (tailored ? 3 : 0) +
        (growth ? 0 : 2) +
        (v.concerns.length === 0 ? 1 : 0) +
        (cut.trend2026 ? 1 : 0) +
        (cut.dailyMinutes <= 3 ? 1 : 0);
      const reasons: PickReason[] = [
        ...fitReason(cut, type, tailored),
        growth ? { kind: "growFirst" } : { kind: "readyNow" },
        ...(v.concerns.some((c) => c !== "growth") ? [{ kind: "products" } as const] : []),
        { kind: "styling", minutes: cut.dailyMinutes },
        { kind: "trims", weeks: cut.trimWeeks },
        ...(cut.trend2026 ? [{ kind: "trend" } as const] : []),
      ];
      return [{ cut, score, reasons }];
    })
    .sort((a, b) => b.score - a.score || b.cut.trimWeeks - a.cut.trimWeeks || a.cut.id.localeCompare(b.cut.id));
  return scored.slice(0, 3).map((s) => ({ cutId: s.cut.id, reasons: s.reasons }));
}

function fitReason(cut: PickCut, type: HairType | undefined, tailored: boolean): PickReason[] {
  if (tailored && type) return [{ kind: "tailored", type }];
  if (cut.types.length === 4) return [{ kind: "universal" }];
  return type ? [{ kind: "suits", type }] : [];
}
