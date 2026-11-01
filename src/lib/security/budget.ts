import "server-only";
import type { CounterStore } from "./store";

// YouCam unit ledger and circuit breaker.
// reserve → call YouCam → settle (adjust to the actual charge, refund on an uncharged failure).

export type Pool = "public" | "judge";

export interface BudgetLimits {
  publicDailyCap: number;
  judgeCap: number;
  /** Kill switch (YOUCAM_DISABLED): every pool refuses. */
  disabled: boolean;
}

export interface Reservation {
  key: string;
  units: number;
}

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: "disabled" | "breaker_open" | "budget_exhausted" };

const BREAKER_KEY = "breaker:state";
const DAY = 86400;

export function poolKey(pool: Pool, now = Date.now()): string {
  return pool === "judge" ? "credits:judge" : `credits:${new Date(now).toISOString().slice(0, 10)}:public`;
}

export async function isBreakerOpen(store: CounterStore): Promise<boolean> {
  return (await store.get(BREAKER_KEY)) === "open";
}

/** Opening the breaker cuts public traffic to demo mode; the judge pool keeps working. */
export async function setBreaker(store: CounterStore, open: boolean): Promise<void> {
  if (open) await store.set(BREAKER_KEY, "open");
  else await store.del(BREAKER_KEY);
}

export async function reserveUnits(
  store: CounterStore,
  limits: BudgetLimits,
  pool: Pool,
  units: number,
  now = Date.now(),
): Promise<ReserveResult> {
  if (limits.disabled) return { ok: false, reason: "disabled" };
  if (pool === "public" && (await isBreakerOpen(store))) return { ok: false, reason: "breaker_open" };

  const key = poolKey(pool, now);
  const cap = pool === "judge" ? limits.judgeCap : limits.publicDailyCap;
  // Public keys carry the UTC date, so they reset daily without a cron; keep them two days for inspection.
  const ttl = pool === "judge" ? 60 * DAY : 2 * DAY;
  const total = await store.reserve(key, units, cap, ttl);
  if (total === null) return { ok: false, reason: "budget_exhausted" };
  return { ok: true, reservation: { key, units } };
}

/** Replace the reserved amount with what YouCam actually charged (0 refunds it all). */
export async function settleUnits(store: CounterStore, reservation: Reservation, actualUnits: number): Promise<void> {
  const delta = actualUnits - reservation.units;
  if (delta !== 0) await store.incrBy(reservation.key, delta, 2 * DAY);
}
