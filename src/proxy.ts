import { NextResponse, type NextRequest } from "next/server";
import { API_CSP, newNonce, pageCsp } from "./lib/security/csp";
import { isSameOrigin } from "./lib/security/origin";
import {
  cookieOptions,
  isJudgeCode,
  JUDGE_COOKIE,
  JUDGE_MAX_AGE,
  newJudgeToken,
  newSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  verifySessionToken,
} from "./lib/security/session";

// Runs before every request (Next 16 renamed middleware.ts → proxy.ts).
//  1. State-changing /api/* calls must come from our own origin.
//  2. ?k=<code> → judge cookie, then a 303 to the same URL without ?k= (keeps the code out of history).
//  3. Every visitor gets a signed anonymous session cookie.
//  4. Pages get a per-request nonce CSP (pages render dynamically for it); API responses a deny-all one.

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(request.method);

  if (isApi && isWrite && !isSameOrigin(request.headers, request.url)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!isApi && searchParams.has("k")) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("k");
    const response = NextResponse.redirect(clean, 303);
    response.headers.set("Referrer-Policy", "no-referrer");
    // Wrong codes are dropped silently: same redirect, no cookie, no hint.
    if (isJudgeCode(searchParams.get("k") ?? "")) {
      response.cookies.set(JUDGE_COOKIE, newJudgeToken(), cookieOptions(JUDGE_MAX_AGE));
    }
    return response;
  }

  // New or tampered session: mint one, and pass it on to this same request so
  // a route handler hit first (before any page load) still sees a session.
  const token = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value) ? null : newSessionToken();
  if (token) request.cookies.set(SESSION_COOKIE, token);

  const csp = isApi ? API_CSP : pageCsp(newNonce(), process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  if (!isApi) headers.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  if (token) response.cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
