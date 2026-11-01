"use client";

import { photoMemory } from "./photo-memory";

// Small JSON client for our own /api routes. Errors come back as codes, never vendor detail.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

export async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof data.error === "string" ? data.error : "try_again", status: res.status };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "try_again", status: 0 };
  }
}

/** Re-sends the in-memory front photo when the server's reference expired. False if it's gone. */
export async function reuploadFront(turnstileToken: string | undefined): Promise<boolean> {
  const front = photoMemory.get();
  if (!front) return false;
  const form = new FormData();
  form.append("image", front, "front.jpg");
  form.append("mode", "reupload");
  if (turnstileToken) form.append("turnstileToken", turnstileToken);
  try {
    const res = await fetch("/api/scan", { method: "POST", body: form });
    return res.ok;
  } catch {
    return false;
  }
}
