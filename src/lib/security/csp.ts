// Content-Security-Policy, built per request with a fresh nonce. Pure, so proxy.ts and
// tests share it. Next.js reads the nonce from the request's CSP header and applies it to its own
// inline scripts; 'strict-dynamic' then trusts the scripts those load (MediaPipe, Turnstile).

const TURNSTILE = "https://challenges.cloudflare.com";

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function pageCsp(nonce: string, dev = false): string {
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' is for MediaPipe's WASM; 'unsafe-eval' only in dev (React's tooling).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' ${TURNSTILE}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${TURNSTILE}${dev ? " ws:" : ""}`,
    `frame-src ${TURNSTILE}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/** API responses are data, never documents. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'";
