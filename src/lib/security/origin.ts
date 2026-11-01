// Same-origin check for state-changing /api/* requests. No CORS: other origins are refused.
// Pure (no "server-only") so proxy.ts and route handlers can both use it.

/**
 * True only when the browser says the request came from our own origin.
 * Prefers Sec-Fetch-Site (set by every current browser, not forgeable by page script);
 * falls back to comparing Origin with the request's own origin.
 */
export function isSameOrigin(headers: Headers, requestUrl: string): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}
