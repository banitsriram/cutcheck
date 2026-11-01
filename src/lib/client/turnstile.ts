"use client";

import { useCallback, useEffect, useRef } from "react";

// Invisible Cloudflare Turnstile. Without NEXT_PUBLIC_TURNSTILE_SITE_KEY (local dev)
// it returns no token and the server skips the check outside production.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  execute(id: string): void;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT_SRC, async: true });
    script.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile"))));
    script.addEventListener("error", () => reject(new Error("turnstile")));
    if (!existing) document.head.appendChild(script);
  });
}

/** Returns a ref for the (hidden) widget container and a function that fetches a fresh token. */
export function useTurnstile() {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const pending = useRef<{ resolve: (t: string | undefined) => void } | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !container.current) return;
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled || !container.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: SITE_KEY,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => pending.current?.resolve(token),
          "error-callback": () => pending.current?.resolve(undefined),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
  }, []);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    const api = window.turnstile;
    if (!SITE_KEY || !api || !widgetId.current) return undefined;
    const id = widgetId.current;
    return new Promise((resolve) => {
      pending.current = { resolve };
      api.reset(id);
      api.execute(id);
    });
  }, []);

  return { container, getToken };
}
