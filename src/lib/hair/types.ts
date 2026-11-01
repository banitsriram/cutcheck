import { z } from "zod";

// Internal hair model. YouCam values are translated into these by lib/youcam/mappers.ts.
// YouCam returns no confidence scores, so readings carry none.

export const HAIR_TYPES = ["straight", "wavy", "curly", "coily"] as const;
export const HAIR_LENGTHS = ["buzz", "short", "medium", "long"] as const; // ordinal
export const FRIZZ_LEVELS = ["low", "medium", "high"] as const; // ordinal
export const DENSITY_LEVELS = ["low", "medium", "high"] as const; // ordinal

export type HairType = (typeof HAIR_TYPES)[number];
export type HairLength = (typeof HAIR_LENGTHS)[number];
export type Frizz = (typeof FRIZZ_LEVELS)[number];
export type Density = (typeof DENSITY_LEVELS)[number];

/**
 * unclear_photo: YouCam rejected the photo (pose, angle, no face). api_error: failed or timed out.
 * manual: we don't read this from photos; the user picks it (density).
 */
export const INCONCLUSIVE_REASONS = ["unclear_photo", "api_error", "not_detected", "manual"] as const;
export type InconclusiveReason = (typeof INCONCLUSIVE_REASONS)[number];

export type Reading<T> =
  | { status: "ok"; value: T; source: "api" | "user"; /** YouCam's own wording, shown beside our value. */ term?: string }
  | { status: "inconclusive"; reason: InconclusiveReason };

export interface HairProfile {
  type: Reading<HairType>;
  length: Reading<HairLength>;
  frizz: Reading<Frizz>;
  density: Reading<Density>;
  scannedAt: string; // ISO
}

/**
 * The guided scan's three photos. YouCam's type and frizz need front, right and
 * left views. Front also feeds length and the hair try-on. Density is picked by hand.
 */
export const SHOTS = ["front", "left", "right"] as const;
export type Shot = (typeof SHOTS)[number];

export const READING_KEYS = ["type", "density", "length", "frizz"] as const;
export type ReadingKey = (typeof READING_KEYS)[number];

function readingSchema<T extends readonly [string, ...string[]]>(values: T) {
  return z.discriminatedUnion("status", [
    z
      .object({
        status: z.literal("ok"),
        value: z.enum(values),
        source: z.enum(["api", "user"]),
        term: z.string().max(64).optional(),
      })
      .strict(),
    z.object({ status: z.literal("inconclusive"), reason: z.enum(INCONCLUSIVE_REASONS) }).strict(),
  ]);
}

/** Validates a HairProfile sent by the browser (e.g. to /api/verdict). Unknown keys are rejected. */
export const hairProfileSchema = z
  .object({
    type: readingSchema(HAIR_TYPES),
    length: readingSchema(HAIR_LENGTHS),
    frizz: readingSchema(FRIZZ_LEVELS),
    density: readingSchema(DENSITY_LEVELS),
    scannedAt: z.iso.datetime(),
  })
  .strict();

/** Position on an ordinal scale, e.g. rank(DENSITY_LEVELS, "medium") === 1. */
export function rank<T extends string>(scale: readonly T[], value: T): number {
  return scale.indexOf(value);
}
