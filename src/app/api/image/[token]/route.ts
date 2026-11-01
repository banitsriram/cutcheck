import { requestContext } from "@/lib/security/context";
import { sniffImageType } from "@/lib/security/image";
import { getImageRef } from "@/lib/security/refs";
import { counterStore } from "@/lib/security/store";

// GET /api/image/[token]: streams a result image to the session that created it.
// The vendor URL is fetched server-side and never reaches the browser; nothing is cached.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const NOT_FOUND = (why?: string) => {
  // Reason only, never the token, URL or bytes.
  if (why) console.warn(JSON.stringify({ t: "cutcheck", route: "image", failed: why }));
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
};

export async function GET(request: Request, { params }: RouteContext<"/api/image/[token]">): Promise<Response> {
  const ctx = requestContext(request);
  if (!ctx) return NOT_FOUND("no_session");
  const { token } = await params;
  const image = await getImageRef(counterStore(), ctx.sessionId, token);
  if (!image) return NOT_FOUND("unknown_token");

  if (image.kind === "local") {
    return new Response(null, { status: 302, headers: { Location: image.path, "Cache-Control": "no-store" } });
  }
  try {
    const res = await fetch(image.url, { signal: AbortSignal.timeout(10_000), cache: "no-store", redirect: "error" });
    if (!res.ok) return NOT_FOUND(`vendor_${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Storage buckets often label results octet-stream, so trust the bytes, not the header.
    const kind = sniffImageType(bytes);
    if (!kind) return NOT_FOUND(`unknown_type_${Array.from(bytes.slice(0, 4), (b) => b.toString(16)).join("")}`);
    if (bytes.byteLength > MAX_IMAGE_BYTES) return NOT_FOUND(`too_large_${bytes.byteLength}`);
    return new Response(bytes, {
      headers: {
        "Content-Type": `image/${kind}`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (e) {
    return NOT_FOUND(`fetch_${e instanceof Error ? e.name : "error"}`);
  }
}
