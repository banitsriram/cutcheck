// User-facing copy for the see it → wear it → keep it screens, demo mode and deletion.
// Checked by the claims linter. Tone: second person, honest, no hype.

export const demoCopy = {
  banner: "Demo mode: precomputed results from real YouCam API calls.",
  bannerImages: "Images here are illustrations, not real try-on output.",
  startReal: "Scan your own hair instead",
  loading: "Loading the demo…",
  offer: "See the demo",
} as const;

export const tryOnCopy = {
  title: "See it on you",
  intro: "See the cut on your own photo. Most styles keep your own hair colour.",
  colourKept: "Your colour kept",
  colourFromStyle: "Colour comes from the style",
  noCurlyModel:
    "There's no curly-hair model of this cut to try on yet, and showing it on straight hair would mislead you. Your verdict still stands: the kit and stylist card are ready.",
  getKit: "Get the kit for this cut",
  generate: "Show me this cut",
  regenerate: "Try again",
  generating: "Rendering your try-on. This usually takes about 10 seconds…",
  before: "Before",
  after: "After",
  slider: "Drag to compare before and after",
  reference: (cut: string) => `Style photo of the ${cut}`,
  noCut: "Pick a cut from the verdicts first.",
  backToVerdicts: "Back to the verdicts",
  notForYou: "This cut doesn't work with your hair, so we don't offer a try-on for it. Check the closest cut that works instead.",
  noPhoto: "Your photo isn't in this tab any more (it's never stored). Rescan to try cuts on.",
  rescan: "Rescan",
  wearIt: "See the full look",
  keepIt: "Skip to the kit",
  demoNote: "Demo: an illustration stands in for your photo.",
  errors: {
    rate_limited: "You've used today's free try-ons. The demo shows the rest of the flow.",
    budget_exhausted: "Live try-ons are paused right now. The demo shows the full flow.",
    image_rejected: "YouCam couldn't render this cut on your photo. Rescan with your whole head in view.",
    offline: "You seem to be offline. Check your connection and try again.",
    try_again: "We couldn't render this one. Please try again.",
  },
} as const;

export const lookCopy = {
  title: "See the full look",
  intro: "Pick an occasion and see an outfit and shoes on you, next to your new cut.",
  consent:
    "This step uses one full-body photo of you. It goes to YouCam (Perfect Corp) only to dress the photo, and is kept by them for up to 30 days. We store no images.",
  consentCheck: "Use a full-body photo for this step",
  photoTitle: "Your full-body photo",
  photoGuide: "Stand back so you're in frame from head to feet, on your own, in good light.",
  choosePhoto: "Take or choose a photo",
  checking: "Checking your photo…",
  uploading: "Sending your photo…",
  gate: {
    not_portrait: "Hold the phone upright so your whole body fits, head to feet.",
    multiple_faces: "We can see more than one person. Take the photo on your own.",
    too_small: "This photo is too small. Use your phone's main camera.",
    too_dark: "Too dark. Find better light.",
    too_bright: "Too bright. Step out of direct sunlight.",
    blurry: "A bit blurry. Hold still and try again.",
  },
  styleTitle: "Pick an outfit style",
  styles: { masculine: "Masculine", feminine: "Feminine" },
  occasionTitle: "Pick an occasion",
  outfitStep: "Outfit",
  shoesStep: "Shoes",
  running: "Working on it. This usually takes 10 to 30 seconds…",
  waiting: "Next",
  done: "Done",
  failed: "Didn't work this time",
  shoesPartial: "The outfit worked, but the shoes didn't. Here's the outfit on its own.",
  hairBeside: "Your cut",
  hairMissing: "Try a cut on first to see it here.",
  skip: "Skip to the kit",
  keepIt: "Get the kit for this cut",
  otherOccasion: "Try another occasion",
  demoNote: "Demo: illustrations stand in for the outfit and shoes.",
  errors: {
    rate_limited: "You've used today's free looks. The demo shows the rest of the flow.",
    budget_exhausted: "Live looks are paused right now. The demo shows the full flow.",
    image_rejected: "YouCam couldn't use this photo. Try one with your whole body in view.",
    photo_needed: "Your full-body photo expired. Add it again to continue.",
    bot_check_failed: "We couldn't confirm the request came from a person. Reload and try again.",
    offline: "You seem to be offline. Check your connection and try again.",
    try_again: "This step didn't work. Please try again.",
  },
} as const;

export const kitCopy = {
  title: "Keep it",
  intro: "The products and routine that keep this cut looking right on your hair.",
  steps: { wash: "Wash", style: "Style", finish: "Finish" },
  forType: (type: string) => `Picked for ${type} hair.`,
  forConcern: {
    frizz: "Your frizz reads above this cut's limit, and this keeps it smooth.",
    volume: "Your density is close to what this cut needs, and this adds volume.",
  },
  typeUnknown: "We couldn't read your hair type, so only routine products are listed. Set it on the readings screen for a full kit.",
  trim: (weeks: number) => `Trim every ${weeks} weeks to keep the shape.`,
  nextTrim: (date: string) => `Next trim: around ${date}.`,
  daily: (minutes: number) => (minutes === 0 ? "No daily styling needed." : `About ${minutes} minutes of styling a day.`),
  grow: (weeks: number) => `Grow for about ${weeks} weeks before the first cut (an estimate).`,
  addToCart: "Add kit to cart",
  added: "Kit is in your cart",
  barberTitle: "For your barber or stylist",
  barberTop: "Top",
  barberSides: "Sides",
  barberNotes: "Notes",
  makeCard: "Get a stylist card link",
  making: "Making your link…",
  cardReady: "Show this link to your barber or stylist. It has the cut and your hair readings, never a photo.",
  copy: "Copy link",
  copied: "Copied",
  share: "Share",
  noCut: "Pick a cut from the verdicts first.",
  loading: "Building your kit…",
  error: "We couldn't build the kit. Please try again.",
  retry: "Try again",
} as const;

export const cartCopy = {
  title: "Your cart",
  banner: "Demo store. Nothing is really bought.",
  empty: "Your cart is empty.",
  remove: (name: string) => `Remove ${name}`,
  total: "Total",
  checkout: "Check out",
  summaryTitle: "Order summary",
  summaryNote: "This is a demo store, so nothing is charged or shipped. In a real store this would go to checkout.",
  close: "Close",
  open: (n: number) => `Cart (${n})`,
} as const;

export const cardCopy = {
  title: "Stylist card",
  intro: "Cut instructions from CutCheck. The hair readings were confirmed by the customer.",
  readings: "Hair readings",
  unknown: "Not read",
  invalid: "This stylist card link isn't valid. Ask for a new one.",
  reference: (cut: string) => `Style photo of the ${cut}`,
  upkeep: (weeks: number) => `Trim every ${weeks} weeks.`,
  footer: "Made with CutCheck. Know before you cut.",
} as const;

export const deleteCopy = {
  title: "Delete my data",
  intro: "One tap removes everything this session holds.",
  button: "Delete everything",
  working: "Deleting…",
  doneTitle: "Deleted",
  removedTab: "Your hair readings, cart and in-memory photos in this tab",
  removedPhoto: "Our reference to your scan photo",
  removedBody: "Our reference to your full-body photo",
  removedImages: (n: number) => `${n} try-on and look image link${n === 1 ? "" : "s"}`,
  vendor: (deleted: number, requested: number) =>
    `YouCam was asked to delete ${requested} task${requested === 1 ? "" : "s"} and their photos; ${deleted} confirmed.`,
  vendorRetention:
    "Anything YouCam couldn't delete yet (or photos uploaded without a task) is removed by Perfect Corp automatically within 30 days.",
  error: "We couldn't reach the server. Your tab data is cleared; please try again for the rest.",
  home: "Back to the start",
  link: "Delete my data",
} as const;

export const salonsCopy = {
  title: "For salons and brands",
  intro: "CutCheck turns a consultation into a clear plan your customer trusts, plus a kit they can buy.",
  points: [
    { heading: "Embed the flow", body: "Run the scan, verdicts and try-on inside your own booking page or in-store tablet." },
    { heading: "Stylist card", body: "Customers arrive with the cut, clipper or length notes and their hair readings, so there's less guesswork in the chair." },
    { heading: "Kits that fit", body: "Every kit is tied to the customer's readings, so recommendations are easy to explain." },
  ],
  measureTitle: "What you can measure",
  measure: ["Scans started and finished", "Share of cuts tried on that work for the customer's hair", "Kit add-to-cart rate", "Stylist cards opened"],
  note: "No numbers here are invented: these are the things a pilot would measure.",
} as const;
