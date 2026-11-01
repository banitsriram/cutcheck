import type { Density, Frizz, HairLength, HairType, Reading } from "../hair/types";
import {
  hairDensityResultSchema,
  hairFrizzResultSchema,
  hairLengthResultSchema,
  hairTypeResultSchema,
  PHOTO_ERRORS,
  type TaskStatus,
} from "./types";

// Vendor results → internal readings. Pure; anything unrecognised becomes
// inconclusive rather than a guess.

const TYPE_FAMILY: Record<string, HairType> = { "1": "straight", "2": "wavy", "3": "curly", "4": "coily" };

/** "4B to 4C" → coily: the lower bound's family. */
export function mapHairType(mapping: string): HairType | null {
  const lower = mapping.trim().toLowerCase().split(/\s+to\s+/)[0];
  return TYPE_FAMILY[lower?.[0] ?? ""] ?? null;
}

const LENGTH_TERMS: Record<string, HairLength> = {
  "above the ears": "short",
  "ear length": "medium",
  "ear length or longer": "medium",
  // YouCam's "short hair" ends around the chin to the shoulders: medium, not long.
  "short hair": "medium",
  "short hair or longer": "medium",
  "above chest": "long",
  "above chest or longer": "long",
  "long hair": "long",
};

export function mapHairLength(term: string): HairLength | null {
  return LENGTH_TERMS[term.trim().toLowerCase()] ?? null;
}

/** 0–1 low, 2 medium, 3 high (our choice). */
export function mapFrizz(level: number): Frizz | null {
  if (level === 0 || level === 1) return "low";
  if (level === 2) return "medium";
  if (level === 3) return "high";
  return null;
}

const DENSITY_TERMS: Record<string, Density> = {
  "extremely low density": "low",
  "low density": "low",
  "medium density": "medium",
  "high density": "high",
};

export function mapDensity(term: string): Density | null {
  return DENSITY_TERMS[term.trim().toLowerCase()] ?? null;
}

const inconclusive = (reason: "unclear_photo" | "api_error" | "not_detected") =>
  ({ status: "inconclusive", reason }) as const;

/** A finished (or failed/timed-out: null) task → reading. */
function toReading<T>(task: TaskStatus | null, read: (results: unknown) => { value: T | null; term?: string } | null): Reading<T> {
  if (!task || task.task_status !== "success") {
    return inconclusive(task?.error && PHOTO_ERRORS.has(task.error) ? "unclear_photo" : "api_error");
  }
  const parsed = read(task.results);
  if (!parsed || parsed.value === null) return inconclusive("not_detected");
  return { status: "ok", value: parsed.value, source: "api", ...(parsed.term ? { term: parsed.term.slice(0, 64) } : {}) };
}

export const readHairType = (task: TaskStatus | null) =>
  toReading(task, (r) => {
    const p = hairTypeResultSchema.safeParse(r);
    return p.success ? { value: mapHairType(p.data.hair_type.mapping), term: p.data.hair_type.term } : null;
  });

export const readHairLength = (task: TaskStatus | null) =>
  toReading(task, (r) => {
    const p = hairLengthResultSchema.safeParse(r);
    return p.success ? { value: mapHairLength(p.data.hair_length.term), term: p.data.hair_length.term } : null;
  });

export const readFrizz = (task: TaskStatus | null) =>
  toReading(task, (r) => {
    const p = hairFrizzResultSchema.safeParse(r);
    return p.success ? { value: mapFrizz(p.data.hair_frizziness.mapping), term: p.data.hair_frizziness.term } : null;
  });

export const readDensity = (task: TaskStatus | null) =>
  toReading(task, (r) => {
    const p = hairDensityResultSchema.safeParse(r);
    return p.success ? { value: mapDensity(p.data.hair_density.term), term: p.data.hair_density.term } : null;
  });
