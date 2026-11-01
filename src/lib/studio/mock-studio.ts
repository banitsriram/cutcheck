import "server-only";
import type { LookStudio } from "./studio";

// Dev/test stand-in: no network, no units. Results are the labelled demo illustrations.

export const mockStudio: LookStudio = {
  source: "mock",
  units: { hair: 0, clothes: 0, shoes: 0 },
  async hair() {
    return { image: { kind: "local", path: "/demo/tryon.svg" }, taskId: null, unitsCharged: 0 };
  },
  async uploadBody() {
    return "mock-body";
  },
  async clothes() {
    return { image: { kind: "local", path: "/demo/look-clothes.svg" }, taskId: null, unitsCharged: 0 };
  },
  async shoes() {
    return { image: { kind: "local", path: "/demo/look-shoes.svg" }, taskId: null, unitsCharged: 0 };
  },
};
