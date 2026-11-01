import { z } from "zod";
import { hairAnalyzer } from "@/lib/analysis";
import type { ScanShots } from "@/lib/analysis/analyzer";
import { SHOTS } from "@/lib/hair/types";
import { apiError, apiJson, requestContext } from "@/lib/security/context";
import { sanitiseImage } from "@/lib/security/image";
import { logEvent } from "@/lib/security/log";
import { checkLimit } from "@/lib/security/ratelimit";
import { addTaskIds, saveFileRef } from "@/lib/security/refs";
import { reserveFor, settleUnits } from "@/lib/security/spend";
import { counterStore } from "@/lib/security/store";
import { verifyTurnstile } from "@/lib/security/turnstile";

// POST /api/scan: three guided shots in, HairProfile out. Guard order: session →
// API limit → validate → bot check → scan limit → sanitise → reserve units → analyze → settle.
// Images live only in this function's memory; the response never contains them.
// mode "reupload" sends the front shot alone as `image` (try-on ref expired).

export const maxDuration = 60;

const ALLOWED_FIELDS = new Set(["image", ...SHOTS, "turnstileToken", "mode"]);
const fieldsSchema = z
  .object({
    turnstileToken: z.string().max(2048).optional(),
    mode: z.enum(["scan", "reupload"]).default("scan"),
  })
  .strict();

/** Whole run: uploads + the 50 s task deadline, inside maxDuration. */
const ANALYZE_TIMEOUT_MS = 57_000;
/** Vercel's request body limit is 4.5 MB; three ≤ 1600 px JPEGs are typically under 2 MB. */
const MAX_BODY_BYTES = 4_400_000;

export async function POST(request: Request): Promise<Response> {
  const ctx = requestContext(request);
  if (!ctx) return apiError("no_session");

  const store = counterStore();
  const apiLimit = await checkLimit(store, "api", ctx);
  if (!apiLimit.allowed) return apiError("rate_limited", apiLimit.retryAfterSeconds);

  // Refuse oversized bodies before reading them.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return apiError("image_rejected", undefined, "too_large");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("bad_request");
  }
  if ([...form.keys()].some((k) => !ALLOWED_FIELDS.has(k))) return apiError("bad_request");
  const fields = fieldsSchema.safeParse({
    turnstileToken: form.get("turnstileToken") ?? undefined,
    mode: form.get("mode") ?? undefined,
  });
  if (!fields.success) return apiError("bad_request");
  const { mode, turnstileToken } = fields.data;
  // Scan needs exactly the three shots; reupload exactly one image.
  const names = mode === "scan" ? SHOTS : (["image"] as const);
  const files = names.map((n) => form.getAll(n));
  if (files.some((f) => f.length !== 1 || !(f[0] instanceof File))) return apiError("bad_request");
  if (mode === "scan" ? form.has("image") : SHOTS.some((s) => form.has(s))) return apiError("bad_request");

  if (!(await verifyTurnstile(turnstileToken)).ok) return apiError("bot_check_failed");

  const limit = await checkLimit(store, mode === "scan" ? "scan" : "reupload", ctx);
  if (!limit.allowed) return apiError("rate_limited", limit.retryAfterSeconds);

  const cleaned = await Promise.all(
    files.map(async ([f]) => sanitiseImage(Buffer.from(await (f as File).arrayBuffer()))),
  );
  const buffers: Buffer[] = [];
  for (const c of cleaned) {
    if (!c.ok) return apiError("image_rejected", undefined, c.reason);
    buffers.push(c.buffer);
  }

  const analyzer = hairAnalyzer();
  if (!analyzer) return apiError("budget_exhausted");

  const reservation = await reserveFor(store, ctx, mode === "scan" ? analyzer.scanUnitsEstimate : analyzer.uploadUnitsEstimate);
  if (!reservation) return apiError("budget_exhausted");

  const started = performance.now();
  try {
    const signal = AbortSignal.timeout(ANALYZE_TIMEOUT_MS);
    if (mode === "reupload") {
      const uploaded = await analyzer.upload(buffers[0], signal);
      await settleUnits(store, reservation, uploaded.unitsCharged);
      await saveFileRef(store, ctx.sessionId, uploaded.fileRef);
      return apiJson({ ok: true });
    }
    const shots = Object.fromEntries(SHOTS.map((s, i) => [s, buffers[i]])) as ScanShots;
    const result = await analyzer.analyze(shots, signal);
    await settleUnits(store, reservation, result.unitsCharged);
    logEvent({ route: "scan", outcome: "ok", ms: performance.now() - started, units: result.unitsCharged });
    await saveFileRef(store, ctx.sessionId, result.fileRef);
    await addTaskIds(store, ctx.sessionId, result.taskIds);
    return apiJson({
      profile: { ...result.readings, scannedAt: new Date().toISOString() },
      source: analyzer.source,
    });
  } catch {
    logEvent({ route: mode === "scan" ? "scan" : "reupload", outcome: "failed", ms: performance.now() - started, units: reservation.units });
    // Keep the reservation: a failure mid-run (e.g. after tasks started) may still be charged.
    return apiError("try_again");
  }
}
