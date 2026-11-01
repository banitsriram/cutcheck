import "server-only";
import { youcamConfigured } from "../youcam/client";
import { youcamStudio } from "../youcam/studio";
import { mockStudio } from "./mock-studio";
import type { LookStudio } from "./studio";

/** Same rules as hairAnalyzer(): YouCam with a key, the mock only outside production, else null (demo). */
export function lookStudio(): LookStudio | null {
  if (process.env.YOUCAM_DISABLED === "true") return null;
  if (process.env.CUTCHECK_FORCE_MOCK === "true" && process.env.NODE_ENV !== "production") return mockStudio;
  if (youcamConfigured()) return youcamStudio;
  return process.env.NODE_ENV === "production" ? null : mockStudio;
}
