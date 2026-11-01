import { verdictCopy } from "@/copy/verdict";
import {
  DENSITY_LEVELS,
  FRIZZ_LEVELS,
  HAIR_LENGTHS,
  rank,
  READING_KEYS,
  type HairProfile,
  type ReadingKey,
} from "../hair/types";
import { weeksToGrow } from "./growth";
import type { CutRule } from "./rules";

// Deterministic verdict engine. Pure functions: same profile + cuts → same verdicts.

export type Severity = "works" | "caution" | "inconclusive" | "no";
export type Concern = "volume" | "frizz" | "growth";

const SEVERITY_ORDER: Record<Severity, number> = { works: 0, caution: 1, inconclusive: 2, no: 3 };

export interface Finding {
  reading: ReadingKey;
  severity: Exclude<Severity, "works">;
  reason: string;
  concern?: Concern;
}

export interface Verdict {
  cutId: string;
  verdict: Severity;
  /** Every non-✓ finding's reason, worst first. Empty for a clean ✓. */
  reasons: string[];
  findings: Finding[];
  /** Concerns that add products to the kit. */
  concerns: Concern[];
  /** Set when the cut needs growth first (rule 4). */
  growthWeeks?: number;
  /** For ✗ only: the nearest cut that works (rule 8); null if none. */
  closestAlternative?: string | null;
}

/**
 * Readings a cut depends on: type and length always; frizz only if maxFrizz is set;
 * density only if it can change the verdict (any density meets "low" with no warn level).
 */
export function requiredReadings(cut: CutRule): ReadingKey[] {
  const { maxFrizz, minDensity, warnAtDensity } = cut.needs;
  return READING_KEYS.filter(
    (k) =>
      (k !== "frizz" || maxFrizz !== undefined) &&
      (k !== "density" || minDensity !== "low" || warnAtDensity !== undefined),
  );
}

function worst(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

/** Findings for one reading; empty when the reading meets the cut's needs. */
function checkReading(cut: CutRule, profile: HairProfile, key: ReadingKey): Finding[] {
  const reading = profile[key];
  if (reading.status === "inconclusive") {
    return [{ reading: key, severity: "inconclusive", reason: verdictCopy.inconclusive(key) }];
  }
  const { needs } = cut;
  switch (key) {
    case "type": {
      const value = profile.type.status === "ok" ? profile.type.value : null;
      if (value && !needs.types.includes(value)) {
        return [{ reading: key, severity: "no", reason: verdictCopy.typeMismatch(value, needs.types) }];
      }
      return [];
    }
    case "density": {
      if (profile.density.status !== "ok") return [];
      const value = profile.density.value;
      const gap = rank(DENSITY_LEVELS, needs.minDensity) - rank(DENSITY_LEVELS, value);
      if (gap >= 2) {
        return [{ reading: key, severity: "no", reason: verdictCopy.densityFarBelow(value, needs.minDensity) }];
      }
      const atWarnLevel =
        needs.warnAtDensity !== undefined &&
        rank(DENSITY_LEVELS, value) <= rank(DENSITY_LEVELS, needs.warnAtDensity);
      if (gap === 1 || atWarnLevel) {
        return [{ reading: key, severity: "caution", reason: verdictCopy.densityVolume(value), concern: "volume" }];
      }
      return [];
    }
    case "length": {
      if (profile.length.status !== "ok") return [];
      const value = profile.length.value;
      if (rank(HAIR_LENGTHS, value) < rank(HAIR_LENGTHS, needs.minLength)) {
        const weeks = weeksToGrow(value, needs.minLength);
        return [
          { reading: key, severity: "caution", reason: verdictCopy.growFirst(value, needs.minLength, weeks), concern: "growth" },
        ];
      }
      return [];
    }
    case "frizz": {
      if (profile.frizz.status !== "ok" || needs.maxFrizz === undefined) return [];
      const value = profile.frizz.value;
      if (rank(FRIZZ_LEVELS, value) > rank(FRIZZ_LEVELS, needs.maxFrizz)) {
        return [
          { reading: key, severity: "caution", reason: verdictCopy.frizzAbove(value, needs.maxFrizz), concern: "frizz" },
        ];
      }
      return [];
    }
  }
}

/** Verdict for one cut, without the closest alternative (that needs every cut's verdict). */
export function evaluateCut(cut: CutRule, profile: HairProfile): Verdict {
  const required = requiredReadings(cut);
  const isUserInput = (k: ReadingKey) => {
    const r = profile[k];
    return r.status === "ok" && r.source === "user";
  };

  let findings = required.flatMap((k) => checkReading(cut, profile, k));

  // Rule 7 (low-confidence readings) was dropped: YouCam returns no confidence.
  // Unclear photos become inconclusive readings instead, which never produce a ✗.
  // Rule 9: flag reasons that rest on a user-edited reading.
  findings = findings.map((f) =>
    isUserInput(f.reading) ? { ...f, reason: f.reason + verdictCopy.userInput } : f,
  );

  // Worst first; ties keep reading order (type, density, length, frizz), Array.sort is stable.
  findings.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);

  const verdict = findings.reduce<Severity>((acc, f) => worst(acc, f.severity), "works");
  const result: Verdict = {
    cutId: cut.id,
    verdict,
    reasons: findings.map((f) => f.reason),
    findings,
    concerns: [...new Set(findings.flatMap((f) => (f.concern ? [f.concern] : [])))],
  };
  if (result.concerns.includes("growth") && profile.length.status === "ok") {
    result.growthWeeks = weeksToGrow(profile.length.value, cut.needs.minLength);
  }
  return result;
}

/**
 * Rule 8: nearest alternative to `target` among `candidates`, ranked by
 * same minLength → smallest trim-interval gap → smallest daily-minutes gap → id.
 */
export function closestAlternative(target: CutRule, candidates: readonly CutRule[]): string | null {
  const ranked = candidates
    .filter((c) => c.id !== target.id)
    .map((c) => ({
      id: c.id,
      sameLength: c.needs.minLength === target.needs.minLength ? 0 : 1,
      trimGap: Math.abs(c.upkeep.trimWeeks - target.upkeep.trimWeeks),
      minutesGap: Math.abs(c.upkeep.dailyMinutes - target.upkeep.dailyMinutes),
    }))
    .sort(
      (a, b) =>
        a.sameLength - b.sameLength ||
        a.trimGap - b.trimGap ||
        a.minutesGap - b.minutesGap ||
        a.id.localeCompare(b.id),
    );
  return ranked[0]?.id ?? null;
}

/** Verdicts for every cut, in the cuts' order, with closest alternatives for each ✗. */
export function evaluateAll(profile: HairProfile, cuts: readonly CutRule[]): Verdict[] {
  const verdicts = cuts.map((cut) => evaluateCut(cut, profile));
  const bySeverity = (s: Severity) => cuts.filter((_, i) => verdicts[i].verdict === s);
  const works = bySeverity("works");
  const caution = bySeverity("caution");

  return verdicts.map((v, i) => {
    if (v.verdict !== "no") return v;
    const pool = works.length > 0 ? works : caution;
    return { ...v, closestAlternative: closestAlternative(cuts[i], pool) };
  });
}
