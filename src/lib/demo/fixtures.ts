import type { HairProfile } from "../hair/types";

// Demo mode: real readings from a team member, captured once from the YouCam API with
// consent. No photos: try-on and look screens show labelled illustrations instead.

export const DEMO_PROFILE: HairProfile = {
  type: { status: "ok", value: "coily", source: "api", term: "Coily to Extremely Coily" },
  length: { status: "ok", value: "medium", source: "api", term: "ear length" },
  frizz: { status: "ok", value: "medium", source: "api", term: "Frizzy" },
  // Density is picked by hand in every scan; the demo shows a pick, marked as the user's.
  density: { status: "ok", value: "medium", source: "user" },
  scannedAt: "2026-10-31T09:00:00.000Z",
};

/** Illustrations standing in for result images in demo mode. */
export const DEMO_IMAGES = {
  tryon: "/demo/tryon.svg",
  clothes: "/demo/look-clothes.svg",
  shoes: "/demo/look-shoes.svg",
} as const;
