import { describe, expect, it } from "vitest";
import { verdictCopy } from "@/copy/verdict";
import { findBannedTerms } from "@/lib/claims/lint";
import {
  DENSITY_LEVELS,
  FRIZZ_LEVELS,
  HAIR_LENGTHS,
  HAIR_TYPES,
  hairProfileSchema,
  type Density,
  type Frizz,
  type HairLength,
  type HairProfile,
  type HairType,
  type Reading,
} from "@/lib/hair/types";
import { closestAlternative, evaluateAll, evaluateCut, requiredReadings } from "@/lib/verdict/engine";
import { weeksToGrow } from "@/lib/verdict/growth";
import { DEMO_PROFILE } from "@/lib/demo/fixtures";
import { CUTS, cutRuleSchema, PENDING_TEMPLATE, previewTemplate, type CutRule } from "@/lib/verdict/rules";

// ---------- helpers ----------

const ok = <T,>(value: T, source: "api" | "user" = "api"): Reading<T> => ({ status: "ok", value, source });
const unread = { status: "inconclusive", reason: "not_detected" } as const;

/** Profile that satisfies every cut except on type; override any reading. */
function profile(over: Partial<Omit<HairProfile, "scannedAt">> = {}): HairProfile {
  return {
    type: ok<HairType>("straight"),
    length: ok<HairLength>("long"),
    frizz: ok<Frizz>("low"),
    density: ok<Density>("high"),
    scannedAt: "2026-10-30T10:00:00.000Z",
    ...over,
  };
}

const cut = (id: string) => {
  const c = CUTS.find((x) => x.id === id);
  if (!c) throw new Error(`no cut ${id}`);
  return c;
};

/** Minimal synthetic cut for ranking tests. */
function syntheticCut(id: string, over: Partial<CutRule["needs"]> = {}, upkeep = { trimWeeks: 4, dailyMinutes: 5 }): CutRule {
  const products = { straight: ["p"], wavy: ["p"], curly: ["p"], coily: ["p"] };
  return {
    id,
    name: id,
    aliases: [],
    trend2026: false,
    audience: ["men"],
    needs: { types: ["straight"], minDensity: "low", minLength: "short", ...over },
    upkeep,
    productsByType: products,
    barber: { top: "", sides: "", notes: "" },
    blurb: "x",
    referenceImage: `/cuts/${id}.webp`,
    hairStyleTemplateId: PENDING_TEMPLATE,
    keepsColour: true,
  };
}

const wordCount = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// ---------- data ----------

describe("cuts.json", () => {
  it("has 8–20 valid cuts with unique ids", () => {
    expect(CUTS.length).toBeGreaterThanOrEqual(8);
    expect(CUTS.length).toBeLessThanOrEqual(20);
    for (const c of CUTS) expect(cutRuleSchema.safeParse(c).success).toBe(true);
  });

  it("has at least one volume cut that needs high density", () => {
    expect(cut("afro").needs.minDensity).toBe("high");
  });

  it("maps every cut to a real try-on style (G1)", () => {
    for (const c of CUTS) expect(c.hairStyleTemplateId).not.toBe(PENDING_TEMPLATE);
  });

  it("rejects warnAtDensity below minDensity", () => {
    const bad = syntheticCut("x", { minDensity: "medium", warnAtDensity: "low" });
    expect(cutRuleSchema.safeParse(bad).success).toBe(false);
  });
});

describe("try-on template by hair type", () => {
  const crop = CUTS.find((c) => c.id === "textured-crop")!;
  const pixie = CUTS.find((c) => c.id === "pixie")!;
  it("gives curly and coily hair a curly model when the cut has one", () => {
    expect(previewTemplate(crop, "curly")?.id).toBe("male_short_curly");
    expect(previewTemplate(crop, "coily")?.id).toBe("male_short_curly");
    expect(previewTemplate(crop, "straight")?.id).toBe(crop.hairStyleTemplateId);
    expect(previewTemplate(crop, undefined)?.id).toBe(crop.hairStyleTemplateId);
  });
  it("never gives curly or coily hair a straight model: no curly model means no try-on", () => {
    expect(previewTemplate(pixie, "curly")).toBeNull();
    expect(previewTemplate(pixie, "wavy")?.id).toBe(pixie.hairStyleTemplateId);
  });
  it("offers every curly/coily-only cut a try-on for curly and coily hair", () => {
    for (const c of CUTS.filter((c) => !c.needs.types.includes("straight") && !c.needs.types.includes("wavy"))) {
      expect(previewTemplate(c, "coily"), c.id).not.toBeNull();
    }
  });
});

describe("hairProfileSchema", () => {
  it("accepts a valid profile and rejects unknown keys", () => {
    expect(hairProfileSchema.safeParse(profile()).success).toBe(true);
    expect(hairProfileSchema.safeParse({ ...profile(), extra: 1 }).success).toBe(false);
    expect(hairProfileSchema.safeParse({ ...profile(), type: { ...ok("straight"), score: 9 } }).success).toBe(false);
  });
});

// ---------- rules ----------

describe("rule 2, type: every cut × every type", () => {
  for (const c of CUTS) {
    for (const t of HAIR_TYPES) {
      const expected = c.needs.types.includes(t) ? "works" : "no";
      it(`${c.id} on ${t} hair → ${expected}`, () => {
        expect(evaluateCut(c, profile({ type: ok(t) })).verdict).toBe(expected);
      });
    }
  }
});

describe("rule 1: inconclusive readings", () => {
  it("makes a cut inconclusive when a required reading is unread", () => {
    const v = evaluateCut(cut("curtains"), profile({ frizz: unread }));
    expect(v.verdict).toBe("inconclusive");
    expect(v.reasons).toEqual([verdictCopy.inconclusive("frizz")]);
  });

  it("ignores readings the cut doesn't require", () => {
    expect(requiredReadings(cut("buzz-cut"))).not.toContain("frizz");
    expect(evaluateCut(cut("buzz-cut"), profile({ frizz: unread })).verdict).toBe("works");
  });

  it("skips density when the cut accepts any density (minDensity low)", () => {
    expect(evaluateCut(syntheticCut("any"), profile({ density: unread, length: ok("short") })).verdict).toBe("works");
  });

  it("still needs density when minDensity is above low", () => {
    const c = syntheticCut("vol", { minDensity: "medium" });
    expect(evaluateCut(c, profile({ density: unread, length: ok("short") })).verdict).toBe("inconclusive");
  });

  it("lets a definite ✗ outrank inconclusive, and lists both reasons worst first", () => {
    const v = evaluateCut(cut("curtains"), profile({ type: ok("coily"), density: unread }));
    expect(v.verdict).toBe("no");
    expect(v.reasons).toEqual([
      verdictCopy.typeMismatch("coily", ["straight", "wavy"]),
      verdictCopy.inconclusive("density"),
    ]);
  });
});

describe("rule 3: density", () => {
  it("one level below minDensity → ⚠ with volume concern", () => {
    const v = evaluateCut(cut("curtains"), profile({ density: ok("low") }));
    expect(v.verdict).toBe("caution");
    expect(v.concerns).toEqual(["volume"]);
  });

  it("two levels below minDensity → ✗", () => {
    const c = syntheticCut("dense", { minDensity: "high" });
    expect(evaluateCut(c, profile({ density: ok("low"), length: ok("short") })).verdict).toBe("no");
  });

  it("afro (needs high): ✗ at low, ⚠ at medium, ✓ at high", () => {
    const coily = { type: ok<HairType>("coily") };
    expect(evaluateCut(cut("afro"), profile({ ...coily, density: ok("low") })).verdict).toBe("no");
    expect(evaluateCut(cut("afro"), profile({ ...coily, density: ok("medium") })).verdict).toBe("caution");
    expect(evaluateCut(cut("afro"), profile({ ...coily, density: ok("high") })).verdict).toBe("works");
  });

  it("warnAtDensity: ⚠ at the warn level even when minDensity is met", () => {
    const c = syntheticCut("warn", { minDensity: "medium", warnAtDensity: "medium" });
    expect(evaluateCut(c, profile({ density: ok("medium"), length: ok("short") })).verdict).toBe("caution");
    expect(evaluateCut(c, profile({ density: ok("high"), length: ok("short") })).verdict).toBe("works");
  });
});

describe("rule 4: length and growth estimate", () => {
  it("uses the bucket table: short→medium ≈ 17 weeks, buzz→medium ≈ 28 weeks", () => {
    expect(weeksToGrow("short", "medium")).toBe(17);
    expect(weeksToGrow("buzz", "medium")).toBe(28);
    expect(weeksToGrow("long", "medium")).toBe(0);
  });

  it("too short → ⚠ 'grow first' with weeks, never ✗", () => {
    for (const len of HAIR_LENGTHS) {
      for (const c of CUTS) {
        // Use a type the cut accepts so only length can count against it.
        const v = evaluateCut(c, profile({ type: ok(c.needs.types[0]), length: ok(len) }));
        expect(v.verdict).not.toBe("no");
      }
    }
    const v = evaluateCut(cut("curtains"), profile({ length: ok("short") }));
    expect(v.verdict).toBe("caution");
    expect(v.growthWeeks).toBe(17);
    expect(v.reasons[0]).toBe(verdictCopy.growFirst("short", "medium", 17));
  });

  it("long enough → no growth estimate", () => {
    expect(evaluateCut(cut("curtains"), profile()).growthWeeks).toBeUndefined();
  });
});

describe("rule 5: frizz", () => {
  it("above maxFrizz → ⚠ with frizz concern", () => {
    const v = evaluateCut(cut("textured-comma"), profile({ frizz: ok("medium") }));
    expect(v.verdict).toBe("caution");
    expect(v.concerns).toEqual(["frizz"]);
  });

  it("at maxFrizz → ✓", () => {
    expect(evaluateCut(cut("curtains"), profile({ frizz: ok("medium") })).verdict).toBe("works");
  });
});

describe("rule 6: all needs met", () => {
  it("is ✓ with no reasons", () => {
    const v = evaluateCut(cut("crew-cut"), profile());
    expect(v).toMatchObject({ verdict: "works", reasons: [], concerns: [] });
  });
});

describe("rule 7: unclear photos", () => {
  it("never turns an unreadable reading into a ✗", () => {
    const unclear = { status: "inconclusive", reason: "unclear_photo" } as const;
    const v = evaluateCut(cut("curtains"), profile({ type: unclear }));
    expect(v.verdict).toBe("inconclusive");
  });

  it("rejects the old confidence field in stored profiles", () => {
    const old = { ...profile(), density: { status: "ok", value: "high", confidence: "low", source: "api" } };
    expect(hairProfileSchema.safeParse(old).success).toBe(false);
  });
});

describe("rule 8: closest alternative", () => {
  const target = syntheticCut("target", { minLength: "medium" }, { trimWeeks: 4, dailyMinutes: 5 });

  it("prefers the same minLength, then trim gap, then minutes gap", () => {
    const a = syntheticCut("a", { minLength: "short" }, { trimWeeks: 4, dailyMinutes: 5 });
    const b = syntheticCut("b", { minLength: "medium" }, { trimWeeks: 6, dailyMinutes: 5 });
    const c = syntheticCut("c", { minLength: "medium" }, { trimWeeks: 5, dailyMinutes: 9 });
    const d = syntheticCut("d", { minLength: "medium" }, { trimWeeks: 5, dailyMinutes: 6 });
    expect(closestAlternative(target, [a, b, c, d])).toBe("d");
    expect(closestAlternative(target, [a, b, c])).toBe("c");
    expect(closestAlternative(target, [a, b])).toBe("b");
    expect(closestAlternative(target, [a])).toBe("a");
  });

  it("breaks full ties by id", () => {
    const y = syntheticCut("y", { minLength: "medium" });
    const x = syntheticCut("x", { minLength: "medium" });
    expect(closestAlternative(target, [y, x])).toBe("x");
  });

  it("never suggests the cut itself, and returns null with no candidates", () => {
    expect(closestAlternative(target, [target])).toBeNull();
    expect(closestAlternative(target, [])).toBeNull();
  });

  it("evaluateAll picks a ✓ cut for each ✗", () => {
    const verdicts = evaluateAll(profile({ type: ok("coily") }), CUTS);
    const works = new Set(verdicts.filter((v) => v.verdict === "works").map((v) => v.cutId));
    for (const v of verdicts.filter((v) => v.verdict === "no")) {
      expect(works.has(v.closestAlternative!)).toBe(true);
    }
  });

  it("falls back to ⚠ cuts when nothing is ✓, and to null when neither exists", () => {
    const noCut = syntheticCut("never", { types: ["coily"] });
    const warnCut = syntheticCut("warn", { types: ["straight"], minLength: "long" });
    const vs = evaluateAll(profile({ length: ok("short") }), [noCut, warnCut]);
    expect(vs[0]).toMatchObject({ verdict: "no", closestAlternative: "warn" });
    const alone = evaluateAll(profile(), [noCut]);
    expect(alone[0]).toMatchObject({ verdict: "no", closestAlternative: null });
  });
});

describe("rule 9: user-edited readings", () => {
  it("flags reasons that rest on user input", () => {
    const v = evaluateCut(cut("curtains"), profile({ density: ok("low", "user") }));
    expect(v.reasons[0].endsWith(verdictCopy.userInput)).toBe(true);
  });
});

// ---------- whole-space properties ----------

describe("every profile × every cut", () => {
  const profiles: HairProfile[] = [];
  for (const t of HAIR_TYPES)
    for (const l of HAIR_LENGTHS)
      for (const f of FRIZZ_LEVELS)
        for (const d of DENSITY_LEVELS) profiles.push(profile({ type: ok(t), length: ok(l), frizz: ok(f), density: ok(d) }));

  it("is deterministic", () => {
    for (const p of profiles) expect(evaluateAll(p, CUTS)).toEqual(evaluateAll(p, CUTS));
  });

  it("keeps reasons ≤ 18 words and free of banned terms", () => {
    for (const p of profiles) {
      for (const v of evaluateAll(p, CUTS)) {
        for (const r of v.reasons) {
          expect(wordCount(r.replace(verdictCopy.userInput, ""))).toBeLessThanOrEqual(18);
          expect(findBannedTerms(r)).toEqual([]);
        }
      }
    }
  });

  it("gives every ✗ a reason and every ✓ none", () => {
    for (const p of profiles) {
      for (const v of evaluateAll(p, CUTS)) {
        if (v.verdict === "works") expect(v.reasons).toEqual([]);
        else expect(v.reasons.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("demo profile", () => {
  it("shows at least one ✓ and gives every ✗ a closest alternative", () => {
    const vs = evaluateAll(DEMO_PROFILE, CUTS);
    expect(vs.some((v) => v.verdict === "works")).toBe(true);
    for (const v of vs.filter((v) => v.verdict === "no")) expect(v.closestAlternative).toBeTruthy();
  });
});

describe("rules discriminate (A1.2)", () => {
  const boards = { everyone: CUTS, men: CUTS.filter((c) => c.audience.includes("men")), women: CUTS.filter((c) => c.audience.includes("women")) };
  for (const [name, cuts] of Object.entries(boards)) {
    for (const t of HAIR_TYPES) {
      for (const d of DENSITY_LEVELS) {
        it(`${name} board, ${t} hair, ${d} density: has a ✓ and a ⚠ or ✗`, () => {
          const vs = evaluateAll(profile({ type: ok(t), density: ok(d), length: ok("long"), frizz: ok("medium") }), cuts);
          expect(vs.some((v) => v.verdict === "works")).toBe(true);
          expect(vs.some((v) => v.verdict === "caution" || v.verdict === "no")).toBe(true);
        });
      }
    }
  }

  it("frizz matters for more than 2 cuts", () => {
    expect(CUTS.filter((c) => c.needs.maxFrizz !== undefined).length).toBeGreaterThan(2);
  });
});
