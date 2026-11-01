import { z } from "zod";
import { cardPayload, signCard } from "@/lib/card/sign";
import { hairProfileSchema } from "@/lib/hair/types";
import { apiError, apiJson, readJsonBody, requestContext } from "@/lib/security/context";
import { checkLimit } from "@/lib/security/ratelimit";
import { counterStore } from "@/lib/security/store";
import { CUTS } from "@/lib/verdict/rules";

// POST /api/card: { cutId, profile } → a signed barber-card path.

const bodySchema = z.object({ cutId: z.string().max(64), profile: hairProfileSchema }).strict();

export async function POST(request: Request): Promise<Response> {
  const ctx = requestContext(request);
  if (!ctx) return apiError("no_session");
  const apiLimit = await checkLimit(counterStore(), "api", ctx);
  if (!apiLimit.allowed) return apiError("rate_limited", apiLimit.retryAfterSeconds);

  const body = bodySchema.safeParse(await readJsonBody(request));
  if (!body.success) return apiError("bad_request");
  if (!CUTS.some((c) => c.id === body.data.cutId)) return apiError("bad_request");

  return apiJson({ path: `/card/${signCard(cardPayload(body.data.cutId, body.data.profile))}` });
}
