import "server-only";
import { reserveUnits, settleUnits, type Reservation } from "./budget";
import { serverConfig } from "./config";
import type { RequestContext } from "./context";
import type { CounterStore } from "./store";

// Reserve → run → settle around one paid vendor step, shared by the try-on and Look routes.

export async function reserveFor(store: CounterStore, ctx: RequestContext, units: number): Promise<Reservation | null> {
  const cfg = serverConfig();
  const r = await reserveUnits(
    store,
    { publicDailyCap: cfg.PUBLIC_DAILY_UNIT_CAP, judgeCap: cfg.JUDGE_UNIT_CAP, disabled: cfg.YOUCAM_DISABLED },
    ctx.isJudge ? "judge" : "public",
    units,
  );
  return r.ok ? r.reservation : null;
}

export { settleUnits };
