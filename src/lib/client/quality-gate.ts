// Client-side photo quality gate. Runs before any upload, so a failed
// photo costs zero API units. Pure functions over RGBA pixels so they can be unit-tested.
// Face framing (checkFraming) works on face boxes from MediaPipe's face detector.

import type { Shot } from "../hair/types";

export type GateIssue =
  | "too_small"
  | "too_dark"
  | "too_bright"
  | "blurry"
  | "no_face"
  | "multiple_faces"
  | "too_far"
  | "head_cut_off"
  | "sides_cut_off"
  | "shoulders_cut_off";

export interface GateResult {
  ok: boolean;
  issues: GateIssue[];
  /** Diagnostics for tuning thresholds on real photos (dev only). */
  metrics: { shortSide: number; brightness: number; sharpness: number };
  /** False when the face detector couldn't load and only pixel checks ran. */
  faceCheck?: boolean;
  /** Framing ratios of the best face, compared against GATE when tuning (dev only). */
  framing?: FramingMetrics | null;
}

export interface FramingMetrics {
  faces: number;
  score: number;
  /** Face box width / photo width (vs minFaceWidthShare). */
  widthShare: number;
  /** Space above the box / box height (vs minSpaceAbove). */
  spaceAbove: number;
  /** Narrower side gap / box width (vs minSpaceSide). */
  spaceSide: number;
}

/** Ratios for the highest-scoring face, or null when none was found. */
export function framingMetrics(faces: FaceBox[], width: number): FramingMetrics | null {
  if (faces.length === 0) return null;
  const f = faces.reduce((a, b) => (b.score > a.score ? b : a));
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    faces: faces.length,
    score: round(f.score),
    widthShare: round(f.width / width),
    spaceAbove: round(f.y / f.height),
    spaceSide: round(Math.min(f.x, width - (f.x + f.width)) / f.width),
  };
}

export const GATE = {
  minShortSide: 480,
  minBrightness: 55,
  maxBrightness: 205,
  /** Variance of the Laplacian on a ~256 px greyscale copy. Provisional; tune on real selfies. */
  minSharpness: 40,
  /** Faces below this detector score are ignored. */
  minFaceScore: 0.6,
  /** Face box narrower than this share of the photo width → too far away to read hair. */
  minFaceWidthShare: 0.18,
  /**
   * BlazeFace boxes stop around the brow, so the hair sits above the box. Require clear space
   * above it (as a share of the box height) and beside it (share of the box width).
   * Provisional, like every threshold here: tune on real selfies.
   */
  minSpaceAbove: 0.6,
  minSpaceSide: 0.2,
  /**
   * Space below the box (share of its height): neck and shoulders in frame, so YouCam's length
   * reading can see where longer hair ends. Without it, shoulder-length hair cut off at the chin
   * reads as short.
   */
  minSpaceBelow: 0.8,
} as const;

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

/**
 * Framing issues for the faces found in a photo `width` pixels wide. Only the front shot gets the
 * full check: BlazeFace is unreliable at 45° turns and head-down, and YouCam rejects those shots
 * itself at no cost, so for them we only refuse a second person.
 */
export function checkFraming(faces: FaceBox[], width: number, shot: Shot = "front", height?: number): GateIssue[] {
  const confident = faces.filter((f) => f.score >= GATE.minFaceScore);
  if (confident.length > 1) return ["multiple_faces"];
  if (shot !== "front") return [];
  if (confident.length === 0) return ["no_face"];

  const [f] = confident;
  const issues: GateIssue[] = [];
  if (f.width < width * GATE.minFaceWidthShare) issues.push("too_far");
  if (f.y < f.height * GATE.minSpaceAbove) issues.push("head_cut_off");
  const left = f.x;
  const right = width - (f.x + f.width);
  if (Math.min(left, right) < f.width * GATE.minSpaceSide) issues.push("sides_cut_off");
  if (height !== undefined && height - (f.y + f.height) < f.height * GATE.minSpaceBelow) issues.push("shoulders_cut_off");
  return issues;
}

/** Rec. 601 luma of an RGBA buffer, one value per pixel. */
export function toGrey(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const grey = new Float32Array(width * height);
  for (let i = 0; i < grey.length; i++) {
    grey[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return grey;
}

/** Mean luma of the central 60% of the frame (where the face and hair should be). */
export function centreBrightness(grey: Float32Array, width: number, height: number): number {
  const x0 = Math.floor(width * 0.2), x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.2), y1 = Math.ceil(height * 0.8);
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += grey[y * width + x]; n++; }
  return n ? sum / n : 0;
}

/** Variance of the 4-neighbour Laplacian; low values mean few edges, i.e. blur. */
export function laplacianVariance(grey: Float32Array, width: number, height: number): number {
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = grey[i - width] + grey[i + width] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * @param sample   RGBA pixels of a downscaled copy (~256 px wide) used for brightness and blur
 * @param original dimensions of the full photo, for the resolution check
 */
export function checkQuality(
  sample: { data: Uint8ClampedArray; width: number; height: number },
  original: { width: number; height: number },
): GateResult {
  const grey = toGrey(sample.data, sample.width, sample.height);
  const shortSide = Math.min(original.width, original.height);
  const brightness = centreBrightness(grey, sample.width, sample.height);
  const sharpness = laplacianVariance(grey, sample.width, sample.height);

  const issues: GateIssue[] = [];
  if (shortSide < GATE.minShortSide) issues.push("too_small");
  if (brightness < GATE.minBrightness) issues.push("too_dark");
  if (brightness > GATE.maxBrightness) issues.push("too_bright");
  if (sharpness < GATE.minSharpness) issues.push("blurry");
  return { ok: issues.length === 0, issues, metrics: { shortSide, brightness, sharpness } };
}
