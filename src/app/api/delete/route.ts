import { z } from "zod";
import { apiError, apiJson, readJsonBody, requestContext } from "@/lib/security/context";
import { checkLimit } from "@/lib/security/ratelimit";
import { deleteSessionRefs, getTaskIds } from "@/lib/security/refs";
import { counterStore } from "@/lib/security/store";
import { deleteTask, youcamConfigured as keyConfigured } from "@/lib/youcam/client";

const youcamConfigured = () => keyConfigured() && process.env.CUTCHECK_FORCE_MOCK !== "true";

// POST /api/delete: removes every reference we hold for this session and asks YouCam to delete
// each task (and its files) we started. Reports exactly what was removed.

const bodySchema = z.object({}).strict();

export async function POST(request: Request): Promise<Response> {
  const ctx = requestContext(request);
  if (!ctx) return apiError("no_session");
  const store = counterStore();
  const apiLimit = await checkLimit(store, "api", ctx);
  if (!apiLimit.allowed) return apiError("rate_limited", apiLimit.retryAfterSeconds);
  if (!bodySchema.safeParse(await readJsonBody(request)).success) return apiError("bad_request");

  const taskIds = await getTaskIds(store, ctx.sessionId);
  let vendorDeleted = 0;
  if (youcamConfigured() && taskIds.length > 0) {
    const signal = AbortSignal.timeout(20_000);
    const results = await Promise.all(taskIds.map((id) => deleteTask(id, signal)));
    vendorDeleted = results.filter(Boolean).length;
  }
  const removed = await deleteSessionRefs(store, ctx.sessionId);

  return apiJson({
    removed,
    vendor: { requested: youcamConfigured() ? taskIds.length : 0, deleted: vendorDeleted },
  });
}
