import { z } from "zod";
import cutsJson from "../../../data/cuts.json";
import { DENSITY_LEVELS, FRIZZ_LEVELS, HAIR_LENGTHS, HAIR_TYPES, type HairType } from "../hair/types";

// Cut Requirements Matrix schema. data/cuts.json is validated against this at load.

/** Placeholder template id for synthetic test cuts; every real cut has a v2.1 id. */
export const PENDING_TEMPLATE = "PENDING";
export const AUDIENCES = ["men", "women"] as const;
export type Audience = (typeof AUDIENCES)[number];

const productIds = z.array(z.string().min(1)).min(1);

export const cutRuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    aliases: z.array(z.string()),
    trend2026: z.boolean(),
    audience: z.array(z.enum(AUDIENCES)).min(1),
    needs: z
      .object({
        types: z.array(z.enum(HAIR_TYPES)).min(1),
        minDensity: z.enum(DENSITY_LEVELS),
        warnAtDensity: z.enum(DENSITY_LEVELS).optional(),
        minLength: z.enum(HAIR_LENGTHS),
        maxFrizz: z.enum(FRIZZ_LEVELS).optional(),
      })
      .strict(),
    upkeep: z.object({ trimWeeks: z.number().positive(), dailyMinutes: z.number().nonnegative() }).strict(),
    productsByType: z
      .object({ straight: productIds, wavy: productIds, curly: productIds, coily: productIds })
      .strict(),
    barber: z.object({ top: z.string(), sides: z.string(), notes: z.string() }).strict(),
    /** One plain-language line for people who don't know the cut by name. */
    blurb: z.string().min(1).max(120),
    referenceImage: z.string().startsWith("/"),
    hairStyleTemplateId: z.string().min(1),
    /** The v2.1 template's keep_users_color (B1.2): only then can we say "Your colour kept". */
    keepsColour: z.boolean(),
    /** The model curly/coily users see (may be the main template if it is already curly). None → no try-on for them. */
    curlyTemplate: z.object({ id: z.string().min(1), keepsColour: z.boolean() }).strict().optional(),
  })
  .strict()
  .refine(
    (c) =>
      !c.needs.warnAtDensity ||
      DENSITY_LEVELS.indexOf(c.needs.warnAtDensity) >= DENSITY_LEVELS.indexOf(c.needs.minDensity),
    { message: "warnAtDensity must be at or above minDensity" },
  );

export type CutRule = z.infer<typeof cutRuleSchema>;

export const cutsFileSchema = z
  .array(cutRuleSchema)
  .min(8)
  .max(20)
  .refine((cuts) => new Set(cuts.map((c) => c.id)).size === cuts.length, { message: "duplicate cut id" });

export const CUTS: readonly CutRule[] = cutsFileSchema.parse(cutsJson);

const CURLY: readonly HairType[] = ["curly", "coily"];

/**
 * The try-on template for this person's hair type, and whether it keeps their colour.
 * YouCam pastes the template's hair, so curly/coily hair only gets a curly model; null when the
 * cut has none (we never show a curly person straight hair).
 */
export function previewTemplate(cut: CutRule, type: HairType | undefined): { id: string; keepsColour: boolean } | null {
  if (type && CURLY.includes(type)) return cut.curlyTemplate ?? null;
  return { id: cut.hairStyleTemplateId, keepsColour: cut.keepsColour };
}
