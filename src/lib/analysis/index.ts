import "server-only";
import { youcamAnalyzer, youcamConfigured } from "../youcam/client";
import type { HairAnalyzer } from "./analyzer";
import { mockAnalyzer } from "./mock-analyzer";

/**
 * The analyzer for this request, or null when live analysis isn't available (the caller
 * then offers labelled demo mode). YouCam when a key is configured; otherwise the mock, and
 * only outside production: invented readings must never reach real users.
 */
export function hairAnalyzer(): HairAnalyzer | null {
  if (process.env.YOUCAM_DISABLED === "true") return null;
  // e2e runs set this so a key in .env.local can never be used (playwright.config.ts). Never in production.
  if (process.env.CUTCHECK_FORCE_MOCK === "true" && process.env.NODE_ENV !== "production") return mockAnalyzer;
  if (youcamConfigured()) return youcamAnalyzer;
  return process.env.NODE_ENV === "production" ? null : mockAnalyzer;
}
