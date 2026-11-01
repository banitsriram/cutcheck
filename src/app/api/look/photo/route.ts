import { z } from "zod";
import { lookStudio } from "@/lib/studio";
import { apiError, apiJson, requestContext } from "@/lib/security/context";
import { sanitiseImage } from "@/lib/security/image";
import { checkLimit } from "@/lib/security/ratelimit";
import { saveBodyFileRef } from "@/lib/security/refs";
import { counterStore } from "@/lib/security/store";
import { verifyTurnstile } from "@/lib/security/turnstile";

// POST /api/look/photo: the optional full-body photo (separately consented). Uploading is
// free; it counts as one look against the daily limit. Only a file reference is kept.

export const maxDuration = 30;

const MAX_BODY_BYTES = 4_400_000;
/** Full-body shots need more pixels than a head shot for the outfit to read. */
const BODY_LONGEST_SIDE = 1600;
const fieldsSchema = z.object({ turnstileToken: z.string().max(2048).optional() }).strict();

export async function POST(request: Request): Promise<Response> {
  const ctx = requestContext(request);
  if (!ctx) return apiError("no_session");
  const store = counterStore();
  const apiLimit = await checkLimit(store, "api", ctx);
  if (!apiLimit.allowed) return apiError("rate_limited", apiLimit.retryAfterSeconds);

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return apiError("image_rejected", undefined, "too_large");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("bad_request");
  }
  if ([...form.keys()].some((k) => k !== "image" && k !== "turnstileToken")) return apiError("bad_request");
  const fields = fieldsSchema.safeParse({ turnstileToken: form.get("turnstileToken") ?? undefined });
  const images = form.getAll("image");
  if (!fields.success || images.length !== 1 || !(images[0] instanceof File)) return apiError("bad_request");

  if (!(await verifyTurnstile(fields.data.turnstileToken)).ok) return apiError("bot_check_failed");

  const studio = lookStudio();
  if (!studio) return apiError("budget_exhausted");
  const limit = await checkLimit(store, "look", ctx);
  if (!limit.allowed) return apiError("rate_limited", limit.retryAfterSeconds);

  const cleaned = await sanitiseImage(Buffer.from(await (images[0] as File).arrayBuffer()), BODY_LONGEST_SIDE);
  if (!cleaned.ok) return apiError("image_rejected", undefined, cleaned.reason);

  try {
    const fileRef = await studio.uploadBody(cleaned.buffer, AbortSignal.timeout(20_000));
    await saveBodyFileRef(store, ctx.sessionId, fileRef);
    return apiJson({ ok: true });
  } catch {
    return apiError("try_again");
  }
}
