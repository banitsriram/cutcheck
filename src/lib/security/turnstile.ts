import "server-only";

// Cloudflare Turnstile server-side check. Only routes that accept images call this.
// The visitor's IP is deliberately not forwarded to Cloudflare.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

export type TurnstileResult = { ok: true; skipped?: boolean } | { ok: false };

export async function verifyTurnstile(token: string | undefined): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    // Local dev and tests run without a Cloudflare account; production never does.
    if (process.env.NODE_ENV === "production") return { ok: false };
    return { ok: true, skipped: true };
  }
  if (!token || token.length > 2048) return { ok: false };

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { success?: unknown };
    return data.success === true ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  }
}
