import { z } from "zod";
import { LOOK_IDS, LOOKS } from "@/lib/look/looks";
import { lookStudio } from "@/lib/studio";
import { apiError, apiJson, readJsonBody, requestContext } from "@/lib/security/context";
import { logEvent } from "@/lib/security/log";
import { checkLimit } from "@/lib/security/ratelimit";
import { addTaskIds, getBodyFileRef, saveImageRef, saveLookClothes } from "@/lib/security/refs";
import { reserveFor, settleUnits } from "@/lib/security/spend";
import { counterStore } from "@/lib/security/store";

// POST /api/look/clothes: { occasion } → the outfit on the full-body photo (step 1 of 2).
// The browser calls shoes next, so no route chains two vendor tasks.

export const maxDuration = 60;

const bodySchema = z.object({ occasion: z.enum(LOOK_IDS) }).strict();

export async function POST(request: Request): Promise<Response> {
  const ctx = requestContext(request);
  if (!ctx) return apiError("no_session");
  const store = counterStore();
  const apiLimit = await checkLimit(store, "api", ctx);
  if (!apiLimit.allowed) return apiError("rate_limited", apiLimit.retryAfterSeconds);

  const body = bodySchema.safeParse(await readJsonBody(request));
  if (!body.success) return apiError("bad_request");
  const look = LOOKS.find((l) => l.id === body.data.occasion)!;

  const bodyRef = await getBodyFileRef(store, ctx.sessionId);
  if (!bodyRef) return apiError("photo_needed");
  const studio = lookStudio();
  if (!studio) return apiError("budget_exhausted");
  const limit = await checkLimit(store, "lookStep", ctx);
  if (!limit.allowed) return apiError("rate_limited", limit.retryAfterSeconds);
  const reservation = await reserveFor(store, ctx, studio.units.clothes);
  if (!reservation) return apiError("budget_exhausted");

  const started = performance.now();
  const result = await studio.clothes(bodyRef, look.clothTemplateId, AbortSignal.timeout(57_000)).catch(() => null);
  await settleUnits(store, reservation, result?.unitsCharged ?? studio.units.clothes);
  logEvent({ route: "look-clothes", outcome: result?.image ? "ok" : "failed", ms: performance.now() - started, units: result?.unitsCharged ?? studio.units.clothes });
  if (result?.taskId) await addTaskIds(store, ctx.sessionId, [result.taskId]);
  if (!result?.image) return apiError(result?.failure === "photo" ? "image_rejected" : "try_again");

  await saveLookClothes(store, ctx.sessionId, result.image);
  const token = await saveImageRef(store, ctx.sessionId, result.image);
  return apiJson({ image: `/api/image/${token}`, source: studio.source });
}
