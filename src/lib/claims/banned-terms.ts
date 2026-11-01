// Terms that must never appear in user-facing copy.
// Each entry is a regex source matched case-insensitively at word boundaries,
// so inflections are listed explicitly ("treat" also covers "treatment").
export const BANNED_TERMS: readonly string[] = [
  // Medical or judgemental language about hair
  "bad",
  "thin",
  "thinning",
  "balding",
  "hair loss",
  "unattractive",
  "fix(es|ed|ing)?",
  "cure(s|d)?",
  "treat(s|ed|ing|ment|ments)?",
  "diagnos(e|es|ed|is|tic)",
  "condition(s)?",
  "disease(s)?",
  "alopecia",
  "scalp health",
  // Overclaiming
  "guarantee(s|d)?",
  "clinically",
  "dermatologist[- ]approved",
  "proven",
  "best for you",
  "perfect face",
  "attractive(ness)?",
];

// Phrases that contain a banned term but are required or honest.
// Matched case-insensitively and removed before banned terms are checked.
export const ALLOWED_PHRASES: readonly string[] = [
  "not a guarantee",
  "Visual preview, not a guarantee of the real cut",
];
