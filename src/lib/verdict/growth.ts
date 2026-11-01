import { rank, HAIR_LENGTHS, type HairLength } from "../hair/types";

// Growth estimate for "Grow first" verdicts. Always shown as an estimate.

/** Top length used for the maths, per bucket. */
export const LENGTH_CM: Record<HairLength, number> = {
  buzz: 1,
  short: 4,
  medium: 9,
  long: 18,
};

/** Average scalp hair growth. */
export const GROWTH_CM_PER_MONTH = 1.25;
const WEEKS_PER_MONTH = 4.35;

/** Whole weeks to grow from `current` to `target`; 0 if already long enough. */
export function weeksToGrow(current: HairLength, target: HairLength): number {
  if (rank(HAIR_LENGTHS, current) >= rank(HAIR_LENGTHS, target)) return 0;
  const gapCm = LENGTH_CM[target] - LENGTH_CM[current];
  return Math.round((gapCm / GROWTH_CM_PER_MONTH) * WEEKS_PER_MONTH);
}
