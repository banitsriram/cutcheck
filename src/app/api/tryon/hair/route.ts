import { z } from "zod";
import { lookStudio } from "@/lib/studio";
import { apiError, apiJson, readJsonBody, requestContext } from "@/lib/security/context";
import { logEvent } from "@/lib/security/log";
import { checkLimit } from "@/lib/security/ratelimit";
import { addTaskIds, getFileRef, saveImageRef } from "@/lib/security/refs";
import { reserveFor, settleUnits } from "@/lib/security/spend";
import { counterStore } from "@/lib/security/store";
import { HAIR_TYPES } from "@/lib/hair/types";
import { CUTS, previewTemplate } from "@/lib/verdict/rules";

// POST /api/tryon/hair: { cutId } → a session-bound result image.
// Reuses the front photo uploaded at scan time; one vendor task, keeping the user's colour.

export const maxDuration = 60;

// hairType (the confirmed reading) picks a curly model of the cut for curly/coily hair.
const bodySchema = z.object({ cutId: z.string().max(64), hairType: z.enum(HAIR_TYPES).optional() }).strict();

export async function POST(request: Request): Promise<Response> {
  const ctx = requestContext(request);
  if (!ctx) return apiError("no_session");
  const store = counterStore();
  const apiLimit = await checkLimit(store, "api", ctx);
  if (!apiLimit.allowed) return apiError("rate_limited", apiLimit.retryAfterSeconds);

  const body = bodySchema.safeParse(await readJsonBody(request));
  if (!body.success) return apiError("bad_request");
  const cut = CUTS.find((c) => c.id === body.data.cutId);
  const template = cut && previewTemplate(cut, body.data.hairType);
  if (!template) return apiError("bad_request");

  const fileRef = await getFileRef(store, ctx.sessionId);
  // The browser re-sends its in-memory front photo (mode "reupload") and retries.
  if (!fileRef) return apiError("rescan_needed");

  const studio = lookStudio();
  if (!studio) return apiError("budget_exhausted");
  const limit = await checkLimit(store, "tryonHair", ctx);
  if (!limit.allowed) return apiError("rate_limited", limit.retryAfterSeconds);
  const reservation = await reserveFor(store, ctx, studio.units.hair);
  if (!reservation) return apiError("budget_exhausted");

  const started = performance.now();
  const result = await studio.hair(fileRef, template.id, AbortSignal.timeout(57_000)).catch(() => null);
  await settleUnits(store, reservation, result?.unitsCharged ?? studio.units.hair);
  logEvent({ route: "tryon", outcome: result?.image ? "ok" : "failed", ms: performance.now() - started, units: result?.unitsCharged ?? studio.units.hair });
  if (result?.taskId) await addTaskIds(store, ctx.sessionId, [result.taskId]);
  if (!result?.image) return apiError(result?.failure === "photo" ? "image_rejected" : "try_again");

  const token = await saveImageRef(store, ctx.sessionId, result.image);
  return apiJson({ image: `/api/image/${token}`, source: studio.source });
}
