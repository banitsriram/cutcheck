import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hostname } from "node:os";

// Anonymous identity: no accounts. Shared by src/proxy.ts and route handlers,
// so it reads env directly instead of importing the "server-only" config module.
//   cc_sid   = <128-bit hex id>.<hmac>     anonymous session, issued by the proxy
//   cc_judge = <expiry ms>.<hmac>          judge pass from ?k=JUDGE_CODE; unlocks budget only

export const SESSION_COOKIE = "cc_sid";
export const JUDGE_COOKIE = "cc_judge";
export const SESSION_MAX_AGE = 24 * 60 * 60; // seconds; daily limits are keyed by session
export const JUDGE_MAX_AGE = 30 * 24 * 60 * 60; // covers the Nov 3–20 judging window

/**
 * SESSION_SECRET. Outside production, if it's unset, a fallback derived from this machine and
 * checkout is used. It must be stable rather than random: Next loads proxy.ts and the route
 * handlers as separate module instances, and they must agree on the key.
 */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is missing or shorter than 32 chars");
  return createHash("sha256").update(`cutcheck-dev-only:${hostname()}:${process.cwd()}`).digest("hex");
}

function mac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function newSessionToken(secret = sessionSecret()): string {
  const id = randomBytes(16).toString("hex");
  return `${id}.${mac(secret, `sid:${id}`)}`;
}

/** The session id if the token is ours and untampered, else null. */
export function verifySessionToken(token: string | undefined, secret = sessionSecret()): string | null {
  if (!token) return null;
  const [id, sig, extra] = token.split(".");
  if (extra !== undefined || !id || !sig || !/^[0-9a-f]{32}$/.test(id)) return null;
  return safeEqual(sig, mac(secret, `sid:${id}`)) ? id : null;
}

export function newJudgeToken(now = Date.now(), secret = sessionSecret()): string {
  const exp = String(now + JUDGE_MAX_AGE * 1000);
  return `${exp}.${mac(secret, `judge:${exp}`)}`;
}

export function verifyJudgeToken(token: string | undefined, now = Date.now(), secret = sessionSecret()): boolean {
  if (!token) return false;
  const [exp, sig, extra] = token.split(".");
  if (extra !== undefined || !exp || !sig || !/^\d+$/.test(exp)) return false;
  return safeEqual(sig, mac(secret, `judge:${exp}`)) && Number(exp) > now;
}

/** Constant-time check of a ?k= value against JUDGE_CODE. False when no code is configured. */
export function isJudgeCode(candidate: string, expected = process.env.JUDGE_CODE): boolean {
  if (!expected || expected.length < 16) return false;
  return safeEqual(candidate, expected);
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

/** Reads one cookie from a raw Cookie header. */
export function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
