// Verdict reason copy: second person, ≤ 18 words, names the reading and the requirement.
// Never medical or judgemental words; say "lower density", "finer texture".
import type { Density, Frizz, HairLength, HairType, ReadingKey } from "@/lib/hair/types";

const READING_NAMES: Record<ReadingKey, string> = {
  type: "hair type",
  density: "density",
  length: "length",
  frizz: "frizz",
};

const DENSITY_WORDS: Record<Density, string> = {
  low: "lower",
  medium: "medium",
  high: "high",
};

function list(values: readonly string[]): string {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`;
}

export const verdictCopy = {
  labels: {
    works: "Go for it",
    caution: "Doable, with a little help",
    inconclusive: "We need one more answer",
    no: "Not your hair's cut",
  },

  inconclusive: (reading: ReadingKey) =>
    reading === "density"
      ? "This one depends on how thick your hair is. Pick yours on the readings screen."
      : `We couldn't see your ${READING_NAMES[reading]} clearly. Rescan in brighter light, or just tell us.`,

  typeMismatch: (value: HairType, needs: readonly HairType[]) =>
    `Your hair is ${value}, and this cut only keeps its shape on ${list(needs)} hair.`,

  densityFarBelow: (value: Density, min: Density) =>
    `This cut needs ${DENSITY_WORDS[min]}-density hair for its volume; yours is ${DENSITY_WORDS[value]}.`,

  densityVolume: (value: Density) =>
    `With ${DENSITY_WORDS[value]}-density hair, a volume product gives this cut the lift it needs.`,

  growFirst: (value: HairLength, min: HairLength, weeks: number) =>
    `Not long enough yet: grow it about ${weeks} more weeks, from ${value} to ${min} (rough estimate).`,

  frizzAbove: (value: Frizz, max: Frizz) =>
    `Your frizz is ${value}; this cut looks best at ${max} or less. An anti-frizz product helps.`,

  userInput: " (based on your input)",
} as const;

/** "Our pick for you": warm, plain-language reasons built from the rules (no guessing). */
export const pickCopy = {
  eyebrow: "Our pick for you",
  why: "Why we picked it",
  alsoGreat: "Also great on you",
  tryOn: "Try it on",
  seeAll: "See every cut below",
  reason: (r: import("@/lib/verdict/pick").PickReason): string => {
    switch (r.kind) {
      case "tailored":
        return `It's made for ${r.type} hair, so your natural texture does the styling instead of fighting it.`;
      case "suits":
        return `It sits well on ${r.type} hair like yours.`;
      case "universal":
        return "It works on every hair type, yours included, with no taming needed.";
      case "readyNow":
        return "Your hair is already long enough, so you could book it this week.";
      case "growFirst":
        return "Give it a few weeks of growth and it's yours. The card below says how long.";
      case "products":
        return "A little product from your kit gives it the finish you see in the photo.";
      case "styling":
        return r.minutes === 0 ? "Zero styling: wake up and go." : `About ${r.minutes} minutes in the morning, and you're done.`;
      case "trims":
        return `A tidy-up every ${r.weeks} weeks keeps it looking sharp.`;
      case "trend":
        return "It's one of this year's most-asked-for cuts, so your barber will know it well.";
    }
  },
} as const;

/** What to say in the chair: the cut's notes in plain speech, plus a tip for the hair type. */
export const barberCopy = {
  title: "What to tell your barber",
  intro: "Read this out, or show this screen with the photo.",
  copy: "Copy",
  copied: "Copied",
  lines: (name: string, top: string, sides: string, notes: string) => [
    `Hi! I'd like a ${name.toLowerCase()}, like the photo.`,
    `On top: ${top}.`,
    `On the sides: ${sides}.`,
    `${notes}.`,
  ],
  typeTip: {
    straight: "My hair is straight, so please point-cut the ends. Blunt lines show every snip.",
    wavy: "My hair is wavy; please leave some weight in it so the waves have something to hold.",
    curly: "My hair is curly, so please cut it dry, curl by curl, and go easy with texturising shears.",
    coily: "My hair is coily, so please cut it dry and shape the outline rather than taking bulk out.",
  },
  photoCredit: "Style photo: YouCam hairstyle template",
} as const;
