import { describe, expect, it } from "vitest";
import { BANNED_TERMS } from "@/lib/claims/banned-terms";
import {
  extractCopyStrings,
  extractJsonStrings,
  extractJsxUserText,
  findBannedTerms,
} from "@/lib/claims/lint";

// One natural sentence per banned pattern, so every term is proven to be caught.
const SAMPLES: Record<string, string> = {
  bad: "That cut looks bad on you",
  thin: "You have thin hair",
  thinning: "Signs of thinning",
  balding: "Balding at the crown",
  "hair loss": "Early hair loss",
  unattractive: "An unattractive shape",
  "fix(es|ed|ing)?": "This fixes your volume",
  "cure(s|d)?": "Cures frizz forever",
  "treat(s|ed|ing|ment|ments)?": "A treatment for dryness",
  "diagnos(e|es|ed|is|tic)": "Our diagnosis of your scalp",
  "condition(s)?": "Hair conditions we detect",
  "disease(s)?": "No disease here",
  alopecia: "Alopecia check",
  "scalp health": "Scalp health score",
  "guarantee(s|d)?": "Results guaranteed",
  clinically: "Clinically tested",
  "dermatologist[- ]approved": "Dermatologist-approved routine",
  proven: "A proven method",
  "best for you": "The cut that is best for you",
  "perfect face": "For the perfect face",
  "attractive(ness)?": "Your attractiveness rating",
};

describe("findBannedTerms", () => {
  it("has a sample for every banned term", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...BANNED_TERMS].sort());
  });

  for (const [term, sentence] of Object.entries(SAMPLES)) {
    it(`catches ${term}`, () => {
      expect(findBannedTerms(sentence)).toContain(term);
    });
  }

  it("respects word boundaries", () => {
    expect(findBannedTerms("Show your badge, use a thinner comb? no: fixtures, prefix, proventus")).toEqual([]);
  });

  it("allows the required honest labels", () => {
    expect(findBannedTerms("Visual preview, not a guarantee of the real cut")).toEqual([]);
  });

  it("uses neutral wording without hits", () => {
    expect(findBannedTerms("Lower density, finer texture — works with volume products")).toEqual([]);
  });
});

describe("extractJsxUserText", () => {
  const tsx = `
    // a race condition comment is not user-facing
    export function X() {
      const treat = 1;
      return (
        <div className="font-thin" data-x="bad">
          Know before you cut
          {"A proven method"}
          <img alt="balding preview" src="/a.png" />
          <input placeholder="type here" />
        </div>
      );
    }`;
  const texts = extractJsxUserText(tsx).map((c) => c.text);

  it("collects JSX text, string children and visible attributes", () => {
    expect(texts).toEqual(["Know before you cut", "A proven method", "balding preview", "type here"]);
  });

  it("ignores className, other attributes, identifiers and comments", () => {
    expect(texts.join(" ")).not.toMatch(/font-thin|race condition|data-x/);
  });
});

describe("extractCopyStrings / extractJsonStrings", () => {
  it("reads every string in a copy module", () => {
    const texts = extractCopyStrings(`export const c = { a: "One", b: \`Two \${x} three\` };`).map((c) => c.text);
    expect(texts).toEqual(["One", "Two   three"]);
  });

  it("reads JSON string values, not keys", () => {
    const texts = extractJsonStrings(`{"bad": "fine", "list": ["also fine", 3]}`).map((c) => c.text);
    expect(texts).toEqual(["fine", "also fine"]);
  });
});
