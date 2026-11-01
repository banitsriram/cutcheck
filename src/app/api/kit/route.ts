import { z } from "zod";
import { buildKit } from "@/lib/kit/build";
import { hairProfileSchema } from "@/lib/hair/types";
import { apiError, apiJson, readJsonBody, requestContext } from "@/lib/security/context";
import { checkLimit } from "@/lib/security/ratelimit";
import { counterStore } from "@/lib/security/store";
import { evaluateCut } from "@/lib/verdict/engine";
import { CUTS } from "@/lib/verdict/rules";

// POST /api/kit: { cutId, profile } → the cut's verdict, barber notes and product kit.
// Pure rules, zero API units.

const bodySchema = z.object({ cutId: z.string().max(64), profile: hairProfileSchema }).strict();

export async function POST(request: Request): Promise<Response> {
  const ctx = requestContext(request);
  if (!ctx) return apiError("no_session");
  const apiLimit = await checkLimit(counterStore(), "api", ctx);
  if (!apiLimit.allowed) return apiError("rate_limited", apiLimit.retryAfterSeconds);

  const body = bodySchema.safeParse(await readJsonBody(request));
  if (!body.success) return apiError("bad_request");
  const cut = CUTS.find((c) => c.id === body.data.cutId);
  if (!cut) return apiError("bad_request");

  const verdict = evaluateCut(cut, body.data.profile);
  return apiJson({
    cut: { id: cut.id, name: cut.name, barber: cut.barber, referenceImage: cut.referenceImage },
    verdict,
    kit: buildKit(cut, verdict, body.data.profile),
  });
}
