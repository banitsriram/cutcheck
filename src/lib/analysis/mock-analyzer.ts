import "server-only";
import { createHash } from "node:crypto";
import { FRIZZ_LEVELS, HAIR_LENGTHS, HAIR_TYPES } from "../hair/types";
import type { HairAnalyzer } from "./analyzer";

// Deterministic stand-in for the YouCam hair readings in dev without a key.
// Readings are derived from a hash of the photos, so the same shots always read the same way
// and different shots exercise different verdicts. Charges 0 units; never touches the network.
// Not demo mode: demo mode replays labelled real API results.

function pick<T>(values: readonly T[], byte: number): T {
  return values[byte % values.length];
}

const ref = (image: Buffer) => `mock-file-${createHash("sha256").update(image).digest("hex").slice(0, 16)}`;

export const mockAnalyzer: HairAnalyzer = {
  source: "mock",
  scanUnitsEstimate: 0,
  uploadUnitsEstimate: 0,

  async upload(front) {
    return { fileRef: ref(front), unitsCharged: 0 };
  },

  async analyze(shots) {
    const hash = createHash("sha256");
    for (const image of Object.values(shots)) hash.update(image);
    const h = hash.digest();
    return {
      readings: {
        type: { status: "ok", value: pick(HAIR_TYPES, h[0]), source: "api" },
        length: { status: "ok", value: pick(HAIR_LENGTHS.slice(1), h[1]), source: "api" },
        frizz: { status: "ok", value: pick(FRIZZ_LEVELS, h[2]), source: "api" },
        density: { status: "inconclusive", reason: "manual" },
      },
      fileRef: ref(shots.front),
      taskIds: [],
      unitsCharged: 0,
    };
  },
};
