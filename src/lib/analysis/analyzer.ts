import "server-only";
import type { HairProfile, Shot } from "../hair/types";

// The seam between our pipeline and whatever reads hair from photos.
// The real implementation is the YouCam client (lib/youcam); the mock stands in for dev
// without a key. Route handlers only ever see this interface.

export type ScanShots = Record<Shot, Buffer>;

export interface HairAnalysis {
  readings: Omit<HairProfile, "scannedAt">;
  /** Reference to the uploaded front photo, reused for try-ons. Stored server-side only. */
  fileRef: string;
  /** Vendor task ids, kept per session so /api/delete can remove them. */
  taskIds: string[];
  /** Units actually charged, used to settle the reservation. */
  unitsCharged: number;
}

export interface HairAnalyzer {
  readonly source: "youcam" | "mock";
  /** Units to reserve before a scan (all three readings succeeding). */
  readonly scanUnitsEstimate: number;
  /** Units to reserve for an upload on its own. */
  readonly uploadUnitsEstimate: number;
  /** Upload the front photo only and keep the file ref (`mode: 'reupload'`, ref expired). */
  upload(front: Buffer, signal?: AbortSignal): Promise<{ fileRef: string; unitsCharged: number }>;
  analyze(shots: ScanShots, signal?: AbortSignal): Promise<HairAnalysis>;
}
