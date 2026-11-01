"use client";

import { useMemo, useSyncExternalStore } from "react";
import { hairProfileSchema, type HairProfile } from "@/lib/hair/types";

// Per-tab state: only the derived HairProfile, its source and a consent flag, in
// sessionStorage, which the browser clears when the tab closes. Never images, never localStorage.
// Every access is wrapped: storage can be blocked (private mode, strict settings).

const KEYS = {
  consent: "cc.consent",
  profile: "cc.profile",
  source: "cc.source",
  cart: "cc.cart",
  audience: "cc.audience",
  intro: "cc.intro",
} as const;

/** Where the readings came from. "demo" = the labelled precomputed journey. */
export type ProfileSource = "youcam" | "mock" | "demo";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the flow still works within this page view.
  }
  notify();
}

function parseProfile(raw: string | null): HairProfile | null {
  if (!raw) return null;
  try {
    const parsed = hairProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const sessionState = {
  hasConsent: () => read(KEYS.consent) === "yes",
  giveConsent: () => write(KEYS.consent, "yes"),

  profile: () => parseProfile(read(KEYS.profile)),
  saveProfile(profile: HairProfile, source?: ProfileSource): void {
    if (source) write(KEYS.source, source);
    write(KEYS.profile, JSON.stringify(profile));
  },
  /** Where the readings came from; the UI labels mock readings (never shown in production). */
  isMock: () => read(KEYS.source) === "mock",
  isDemo: () => read(KEYS.source) === "demo",

  /** Verdict board filter the user picked: "men", "women" or "" for everyone. */
  audience: () => read(KEYS.audience) ?? "",
  setAudience: (a: string) => write(KEYS.audience, a || null),

  /** Demo-store cart: product ids only. */
  cart: (): string[] => {
    try {
      const v: unknown = JSON.parse(read(KEYS.cart) ?? "[]");
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 20) : [];
    } catch {
      return [];
    }
  },
  setCart: (ids: string[]) => write(KEYS.cart, JSON.stringify([...new Set(ids)].slice(0, 20))),

  introSeen: () => read(KEYS.intro) === "1",
  markIntroSeen: () => write(KEYS.intro, "1"),

  clearAll(): void {
    for (const key of Object.values(KEYS)) write(key, null);
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The stored profile, re-rendering on change. `undefined` during server render and the first
 * client render (storage isn't readable yet), then the profile or null.
 */
export function useStoredProfile(): HairProfile | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(KEYS.profile) ?? "",
    () => undefined,
  );
  return useMemo(() => (raw === undefined ? undefined : parseProfile(raw)), [raw]);
}

export function useIsMock(): boolean {
  return useSyncExternalStore(subscribe, () => read(KEYS.source) === "mock", () => false);
}

export function useIsDemo(): boolean {
  return useSyncExternalStore(subscribe, () => read(KEYS.source) === "demo", () => false);
}

export function useCart(): string[] {
  const raw = useSyncExternalStore(subscribe, () => read(KEYS.cart) ?? "[]", () => "[]");
  return useMemo(() => {
    void raw;
    return sessionState.cart();
  }, [raw]);
}
