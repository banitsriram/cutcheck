// User-facing copy for the scan → truth screens. Checked by the claims linter.

export const steps = ["Scan", "Truth", "See it", "Wear it", "Keep it"] as const;

export const consentCopy = {
  title: "Before we look at your hair",
  intro: "Here's exactly what happens to your photos.",
  points: [
    "Three photos of your head (straight on and both sides) are sent to YouCam (Perfect Corp) to read your hair type, length and frizz. You pick your density yourself. The straight-on photo is also used to preview cuts.",
    "Our servers store no images. We keep short-lived references for up to 30 minutes so try-ons work, then they expire.",
    "Your hair readings stay in this browser tab and disappear when you close it.",
    "Perfect Corp processes the photos under its own privacy policy and keeps them for up to 30 days, then deletes them automatically.",
    "You can delete everything at any time with one tap.",
    "Only use a photo of yourself. You must be 18 or older.",
  ],
  checkbox: "I understand and want to continue",
  continue: "Continue",
  privacyLink: "Read the full privacy page",
} as const;

export const captureCopy = {
  title: "Three quick photos",
  intro: "YouCam reads your hair from three angles. Keep your hair loose and face the light.",
  progress: (n: number, total: number) => `Photo ${n} of ${total}`,
  shots: {
    front: {
      name: "Straight on",
      guide: "Look straight at the camera. Head and hair inside the oval, shoulders on the line below, so we can see where your hair ends.",
    },
    left: { name: "Turn left", guide: "Turn your head about halfway to your left. Keep your face and hairline in view." },
    right: { name: "Turn right", guide: "Turn your head about halfway to your right. Keep your face and hairline in view." },
  },
  next: "Next photo",
  readHair: "Read my hair",
  retakeShot: (name: string) => `Retake “${name}”`,
  startCamera: "Start camera",
  capture: "Capture",
  retake: "Retake",
  usePhoto: "Use this photo",
  upload: "Upload a photo instead",
  uploadHint: "JPEG, PNG or WebP. It's resized on your device before upload.",
  checking: "Checking your photo…",
  sending: "Reading your hair from all three photos. This usually takes 20 to 40 seconds…",
  cameraDenied: "Camera access is off. You can allow it in your browser settings, or upload a photo instead.",
  cameraUnavailable: "No camera found. Upload a photo instead.",
  mockNotice: "Development mode: readings come from a stand-in, not the YouCam API.",
  gate: {
    too_small: "This photo is too small. Move closer or use your phone's main camera.",
    too_dark: "Too dark. Face a window or turn on a light.",
    too_bright: "Too bright. Step out of direct sunlight or away from the lamp.",
    blurry: "A bit blurry. Hold still and capture again.",
    no_face: "We can't see a face. Face the camera so your whole head is in view.",
    multiple_faces: "We can see more than one person. Take the photo on your own.",
    too_far: "You're a little far away. Move closer so your head fills the oval.",
    head_cut_off: "The top of your head is cut off. Step back or tilt the phone up a little.",
    sides_cut_off: "Your hair is cut off at the side. Centre your head in the oval.",
    shoulders_cut_off: "Step back a little so your shoulders are in. We need to see where your hair ends.",
  },
  errors: {
    rate_limited: "You've used today's free scans. Try again later, or see the demo.",
    budget_exhausted: "Live scans are paused right now. The demo shows the full flow.",
    bot_check_failed: "We couldn't confirm the request came from a person. Reload the page and try again.",
    image_rejected: "We couldn't read that file as a photo. Try a JPEG, PNG or WebP.",
    no_session: "Your session expired. Reload the page and try again.",
    offline: "You seem to be offline. Check your connection and try again.",
    generic: "Something went wrong reading your photo. Please try again.",
  },
} as const;

export const readingsCopy = {
  title: "Your hair readings",
  intro: "Check each reading. If one looks wrong, correct it. The verdicts use what you confirm.",
  names: { type: "Hair type", length: "Length", frizz: "Frizz", density: "Density" },
  values: {
    type: { straight: "Straight", wavy: "Wavy", curly: "Curly", coily: "Coily" },
    length: { buzz: "Buzz (very short)", short: "Short", medium: "Medium", long: "Long" },
    frizz: { low: "Low", medium: "Medium", high: "High" },
    density: { low: "Lower", medium: "Medium", high: "High" },
  },
  vendorTerm: "YouCam read:",
  edited: "Set by you",
  looksWrong: "Looks wrong?",
  chooseValue: "Choose the right value",
  inconclusiveTitle: "We couldn't read this",
  inconclusiveReasons: {
    unclear_photo: "The photo didn't show this clearly enough.",
    api_error: "The reading failed on our side.",
    not_detected: "We couldn't find enough hair in the photo for this.",
    manual: "Pick this one yourself: if your scalp shows easily through your hair, choose Lower; a little, Medium; not at all, High.",
  },
  manualTitle: "Your pick",
  inconclusiveHelp: "Rescan in brighter light, or pick the value yourself.",
  rescan: "Rescan",
  seeVerdicts: "See which cuts work",
  missing: "No readings yet. Start with a scan.",
  startScan: "Scan your hair",
} as const;

export const verdictBoardCopy = {
  title: "Which cuts work for your hair",
  intro: "Every verdict comes from published rules applied to your readings, with no guesswork. Tap a cut for the full reasons.",
  audienceLabel: "Show cuts for",
  audiences: { everyone: "Everyone", men: "Men", women: "Women" },
  filterAll: "All cuts",
  filterWorks: "Works for me",
  closest: "Closest cut that works:",
  tryOn: "Try it on",
  getKit: "Get the kit",
  howWeDecide: "How we decide",
  loading: "Checking every cut against your readings…",
  error: "We couldn't load the verdicts. Please try again.",
  retry: "Try again",
  growthNote: "Growth estimates assume about 1.25 cm a month. It's an estimate, not a promise.",
  basedOnYou: "Some readings were set by you.",
  unread: (names: string) => `We couldn't read your ${names}, so cuts that depend on it show “We need one more answer”. Set it yourself to finish the verdicts.`,
  setReading: "Set it now",
  pickDensity: "One quick question: how thick is your hair? Part it in a mirror and look along the parting, then tap what you see.",
  densityHints: {
    low: "Scalp shows easily along the parting",
    medium: "A little scalp shows",
    high: "Scalp is hard to see",
  },
  editReadings: "Edit readings",
} as const;

export const howWeDecideCopy = {
  title: "How we decide",
  intro:
    "CutCheck doesn't guess. Each cut has written requirements, and your readings are checked against them in the same order every time.",
  rules: [
    "If your hair type isn't one the cut holds on, it's marked as not for your hair.",
    "Density only counts for cuts that need medium or high. One level below means volume products; two levels below means it won't hold.",
    "Too short today? We never rule a cut out for length. We estimate how long it takes to grow.",
    "Frizz above a cut's limit adds an anti-frizz routine to your kit.",
    "Every reading can be corrected by you before verdicts are made.",
    "If we couldn't read something a cut depends on, we say so instead of guessing.",
  ],
  columns: ["Cut", "For", "Holds on", "Density needed", "Length", "Frizz limit", "Trim every"],
  audience: { men: "Men", women: "Women" },
  noFrizzLimit: "Any",
  productsAt: "products needed at",
  weeks: "weeks",
  source:
    "Requirements are our own styling heuristics, written for CutCheck from common barber and stylist practice. They are cosmetic guidance, not a professional consultation.",
} as const;

export const privacyCopy = {
  title: "Privacy",
  sections: [
    {
      heading: "What we send",
      body: "Three photos of your head (straight on and both sides) go to YouCam (Perfect Corp) for hair analysis; the straight-on one is also used to preview cuts. If you choose the full look, one full-body photo goes there too.",
    },
    {
      heading: "What we keep",
      body: "No images on our servers. References to your uploaded photos are kept for up to 30 minutes so try-ons work, then they expire. Your hair readings stay in this browser tab only.",
    },
    {
      heading: "What Perfect Corp keeps",
      body: "Perfect Corp processes photos under its own privacy policy. Uploaded photos and results are kept for up to 30 days, then deleted automatically.",
    },
    {
      heading: "Deleting",
      body: "One tap removes your readings from this tab and every reference we hold, and asks YouCam to delete each task we started together with its photos. Anything YouCam can't delete that way is removed by Perfect Corp within 30 days.",
    },
    {
      heading: "No guessing who you are",
      body: "We never infer your gender from a photo. You choose which cuts and outfit styles to see.",
    },
    {
      heading: "Who can use CutCheck",
      body: "You must be 18 or older and only use photos of yourself.",
    },
    {
      heading: "No tracking",
      body: "No analytics, pixels or session replay. Two cookies: an anonymous session and, for hackathon judges only, a judge pass.",
    },
  ],
} as const;
