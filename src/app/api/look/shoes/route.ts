import { z } from "zod";
import { LOOK_IDS, LOOKS } from "@/lib/look/looks";
import { lookStudio } from "@/lib/studio";
import type { ShoesSource } from "@/lib/studio/studio";
import { apiError, apiJson, readJsonBody, requestContext } from "@/lib/security/context";
import { sanitiseImage } from "@/lib/security/image";
import { logEvent } from "@/lib/security/log";
import { checkLimit } from "@/lib/security/ratelimit";
import { addTaskIds, getBodyFileRef, getLookClothes, saveImageRef } from "@/lib/security/refs";
import { reserveFor, settleUnits } from "@/lib/security/spend";
import { counterStore } from "@/lib/security/store";

// POST /api/look/shoes: { occasion } → Shoes V3 on the outfit result, or on the body photo if the
// outfit step failed (step 2 of 2). The shoe reference is our own catalogue photo.

export const maxDuration = 60;

const bodySchema = z.object({ occasion: z.enum(LOOK_IDS) }).strict();

/** Our own static shoe photo, fetched from this deployment (public files aren't in the function bundle). */
async function shoePhoto(path: string, requestUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(new URL(path, requestUrl), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const cleaned = await sanitiseImage(Buffer.from(await res.arrayBuffer()));
    return cleaned.ok ? cleaned.buffer : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const ctx = requestContext(request);
  if (!ctx) return apiError("no_session");
  const store = counterStore();
  const apiLimit = await checkLimit(store, "api", ctx);
  if (!apiLimit.allowed) return apiError("rate_limited", apiLimit.retryAfterSeconds);

  const body = bodySchema.safeParse(await readJsonBody(request));
  if (!body.success) return apiError("bad_request");
  const look = LOOKS.find((l) => l.id === body.data.occasion)!;

  const [clothes, bodyRef] = await Promise.all([getLookClothes(store, ctx.sessionId), getBodyFileRef(store, ctx.sessionId)]);
  const source: ShoesSource | null = clothes ? { kind: "image", image: clothes } : bodyRef ? { kind: "file", fileRef: bodyRef } : null;
  if (!source) return apiError("photo_needed");
  const studio = lookStudio();
  if (!studio) return apiError("budget_exhausted");
  const shoe = await shoePhoto(look.shoeImage, request.url);
  if (!shoe) return apiError("not_found");

  const limit = await checkLimit(store, "lookStep", ctx);
  if (!limit.allowed) return apiError("rate_limited", limit.retryAfterSeconds);
  const reservation = await reserveFor(store, ctx, studio.units.shoes);
  if (!reservation) return apiError("budget_exhausted");

  const started = performance.now();
  const result = await studio.shoes(source, shoe, AbortSignal.timeout(57_000)).catch(() => null);
  await settleUnits(store, reservation, result?.unitsCharged ?? studio.units.shoes);
  logEvent({ route: "look-shoes", outcome: result?.image ? "ok" : "failed", ms: performance.now() - started, units: result?.unitsCharged ?? studio.units.shoes });
  if (result?.taskId) await addTaskIds(store, ctx.sessionId, [result.taskId]);
  if (!result?.image) return apiError(result?.failure === "photo" ? "image_rejected" : "try_again");

  const token = await saveImageRef(store, ctx.sessionId, result.image);
  return apiJson({ image: `/api/image/${token}`, source: studio.source });
}
