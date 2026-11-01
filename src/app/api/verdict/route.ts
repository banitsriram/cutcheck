import { hairProfileSchema } from "@/lib/hair/types";
import { apiError, apiJson, readJsonBody, requestContext } from "@/lib/security/context";
import { checkLimit } from "@/lib/security/ratelimit";
import { counterStore } from "@/lib/security/store";
import { evaluateAll } from "@/lib/verdict/engine";
import { AUDIENCES, CUTS, type Audience } from "@/lib/verdict/rules";

// POST /api/verdict[?audience=men|women]: HairProfile in, verdicts out. Pure rules, zero API
// units. The audience filter is the user's own choice, never inferred from a photo; closest
// alternatives stay within the chosen board.

export async function POST(request: Request): Promise<Response> {
  const ctx = requestContext(request);
  if (!ctx) return apiError("no_session");

  const apiLimit = await checkLimit(counterStore(), "api", ctx);
  if (!apiLimit.allowed) return apiError("rate_limited", apiLimit.retryAfterSeconds);

  const profile = hairProfileSchema.safeParse(await readJsonBody(request));
  if (!profile.success) return apiError("bad_request");

  const audience = new URL(request.url).searchParams.get("audience");
  const cuts = AUDIENCES.includes(audience as Audience) ? CUTS.filter((c) => c.audience.includes(audience as Audience)) : CUTS;
  return apiJson({ verdicts: evaluateAll(profile.data, cuts) });
}
