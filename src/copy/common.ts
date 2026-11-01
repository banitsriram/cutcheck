// All user-facing strings live in src/copy so the claims linter can check them.
export const common = {
  appName: "CutCheck",
  tagline: "Know before you cut.",
  subline:
    "We read your hair, tell you which trending cuts will actually work, then show you the look.",
  ctaPrimary: "Check my hair",
  ctaDemo: "See a demo",
  ctaHowWeDecide: "How we decide",
  privacyLink: "Privacy",
  footerDisclaimer: "Cosmetic styling guidance, not medical advice.",
  footerPrivacy: "Your photo is sent to YouCam for analysis. We store no images.",
  footerBuiltWith: "Built with YouCam API",
  previewLabel: "Visual preview, not a guarantee of the real cut",
  navRules: "Our rules",
  navCta: "Scan my hair",
  nav: [
    { href: "/#how-it-works", label: "How it works" },
    { href: "/how-we-decide", label: "Our rules" },
    { href: "/privacy", label: "Privacy" },
  ],
} as const;

export const bannerCopy = {
  lineOne: "Your hair, read honestly.",
  lineTwo: "Then the cut that fits.",
  label: "Scan · Verdicts · Try-on",
  bubble: "Hi, I'm Clip! Let's find a cut that works on you.",
} as const;

export const introCopy = { welcome: "Welcome to" } as const;

export const footerCopy = {
  headline: "Know before you cut.",
  line: "Hair, read honestly. Then the cut, the look and the kit.",
  labelLeft: "Hair, read honestly",
  labelRight: "Est. 2026",
} as const;

/** Landing page ("elsewhere" editorial direction). */
export const landingCopy = {
  eyebrowLeft: "Hair, read honestly",
  eyebrowRight: "Built on YouCam / 2026",
  kicker: "A cut is better when it fits.",
  board: {
    headline: "Trending, and right for you.",
    steps: [
      { n: "01", label: "Scan", title: "Three quick photos", detail: "Front, left, right" },
      { n: "02", label: "Truth", title: "Which cuts work", detail: "Rules, not guesses" },
      { n: "03", label: "See it", title: "On your own photo", detail: "Then the full look" },
    ],
    readings: [
      { name: "Hair type", value: "Curly" },
      { name: "Length", value: "Medium" },
      { name: "Frizz", value: "Medium" },
    ],
    verdicts: [
      { cut: "Curly top taper", mark: "✓", tone: "ok" },
      { cut: "Wolf cut", mark: "⚠", tone: "warn" },
      { cut: "Textured comma", mark: "✗", tone: "no" },
    ],
    notes: ["Your hair, your call", "Rules you can read", "Same cut, your curls", "No photos kept"],
    caption: "Sample readings and verdicts, for illustration.",
  },
  marquee: "Cuts we check",
  lookbook: "The lookbook",
  photoCredit: "Style photos: YouCam hairstyle templates",
  thinking: {
    eyebrow: "How it works",
    title: "Trends tell you what's popular. We tell you what works on your hair.",
    body: "Most cut inspiration ignores the hair you actually have. CutCheck reads it first, checks every trending cut against written rules, then lets you see the one you pick on your own photo.",
    points: [
      {
        n: "01",
        title: "Read, don't guess",
        body: "Three photos. YouCam reads your hair type, length and frizz; you set density yourself, and you can correct anything that looks off.",
      },
      {
        n: "02",
        title: "Rules you can check",
        body: "Every go-for-it, doable or not-for-you comes from each cut's written requirements. Same answer every time, and every rule is public.",
      },
      {
        n: "03",
        title: "See it, then wear it",
        body: "Try the cut on your own photo, add an outfit and shoes, then take a stylist card and a product kit to your appointment.",
      },
    ],
    note: "Cosmetic styling guidance, not medical advice. Your photos go to YouCam for analysis; we never store them.",
  },
  final: { eyebrow: "Ready when you are", cta: "Start your scan" },
} as const;
