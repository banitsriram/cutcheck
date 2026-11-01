// GET /api/health: liveness only. No versions, env or budget numbers.
export function GET(): Response {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
