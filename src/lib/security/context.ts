import "server-only";
import { hashIp, type LimitSubject } from "./ratelimit";
import {
  JUDGE_COOKIE,
  readCookie,
  SESSION_COOKIE,
  sessionSecret,
  verifyJudgeToken,
  verifySessionToken,
} from "./session";

// Who is calling, as far as the server can prove it. Route handlers re-verify the
// cookies themselves rather than trusting anything the proxy or the client says.

export interface RequestContext extends LimitSubject {
  sessionId: string;
  isJudge: boolean;
  ipHash: string;
}

/** Vercel puts the client IP first in x-forwarded-for. */
function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/** Null when the request carries no valid session cookie. */
export function requestContext(request: Request, now = Date.now()): RequestContext | null {
  const cookies = request.headers.get("cookie");
  const sessionId = verifySessionToken(readCookie(cookies, SESSION_COOKIE));
  if (!sessionId) return null;
  return {
    sessionId,
    isJudge: verifyJudgeToken(readCookie(cookies, JUDGE_COOKIE), now),
    ipHash: hashIp(clientIp(request.headers), sessionSecret(), now),
  };
}

export type ApiErrorCode =
  | "forbidden"
  | "no_session"
  | "bad_request"
  | "rate_limited"
  | "bot_check_failed"
  | "image_rejected"
  | "budget_exhausted"
  | "rescan_needed"
  | "photo_needed"
  | "not_found"
  | "try_again";

const STATUS: Record<ApiErrorCode, number> = {
  forbidden: 403,
  no_session: 401,
  bad_request: 400,
  rate_limited: 429,
  bot_check_failed: 403,
  image_rejected: 422,
  budget_exhausted: 503,
  rescan_needed: 409,
  photo_needed: 409,
  not_found: 404,
  try_again: 502,
};

/** Generic client-facing error: a code and optional retry hint, never details. */
export function apiError(code: ApiErrorCode, retryAfterSeconds?: number, detail?: string): Response {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfterSeconds !== undefined) headers["Retry-After"] = String(retryAfterSeconds);
  const body = { error: code, ...(retryAfterSeconds !== undefined ? { retryAfter: retryAfterSeconds } : {}), ...(detail ? { detail } : {}) };
  return Response.json(body, { status: STATUS[code], headers });
}

export function apiJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** JSON bodies are capped at 16 KB. Null when too large or not JSON. */
export const MAX_JSON_BYTES = 16 * 1024;

export async function readJsonBody(request: Request): Promise<unknown | null> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_JSON_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
