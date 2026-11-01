import "server-only";
import { createHmac } from "node:crypto";
import type { CounterStore } from "./store";

// Server-side rate limits, sliding-window counters on the shared store.
// A request is admitted only if every applicable rule admits it; only then are counters bumped.
// Check-then-increment can overshoot by a request or two under a burst. That's acceptable for limits;
// the unit ledger (budget.ts) is the strictly atomic guard on spending.

export type LimitedRoute = "scan" | "reupload" | "tryonHair" | "look" | "lookStep" | "api";

interface Rule {
  limit: number;
  windowSeconds: number;
}

const HOUR = 3600;
const DAY = 86400;

interface RouteLimits {
  ip?: Rule[];
  session?: Rule[];
  judgeSession?: Rule[];
}

export const LIMITS: Record<LimitedRoute, RouteLimits> = {
  scan: {
    ip: [{ limit: 3, windowSeconds: HOUR }, { limit: 6, windowSeconds: DAY }],
    session: [{ limit: 2, windowSeconds: DAY }],
    judgeSession: [{ limit: 10, windowSeconds: DAY }],
  },
  reupload: {
    session: [{ limit: 3, windowSeconds: DAY }],
    judgeSession: [{ limit: 10, windowSeconds: DAY }],
  },
  tryonHair: {
    session: [{ limit: 4, windowSeconds: DAY }],
    judgeSession: [{ limit: 20, windowSeconds: DAY }],
  },
  look: {
    session: [{ limit: 2, windowSeconds: DAY }],
    judgeSession: [{ limit: 10, windowSeconds: DAY }],
  },
  // Clothes and shoes calls within a look (the look is counted once, at the photo); this only stops loops.
  lookStep: {
    session: [{ limit: 6, windowSeconds: DAY }],
    judgeSession: [{ limit: 30, windowSeconds: DAY }],
  },
  // Every /api/* request, judges included.
  api: {
    ip: [{ limit: 60, windowSeconds: 60 }],
  },
};

export interface LimitSubject {
  ipHash: string;
  sessionId: string;
  isJudge: boolean;
}

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** Daily-rotating keyed hash of an IP, so raw IPs never reach the store or logs. */
export function hashIp(ip: string, secret: string, now = Date.now()): string {
  const day = new Date(now).toISOString().slice(0, 10);
  return createHmac("sha256", secret).update(`${day}:${ip}`).digest("hex").slice(0, 32);
}

function applicable(route: LimitedRoute, s: LimitSubject): { key: string; rule: Rule }[] {
  const limits = LIMITS[route];
  const out: { key: string; rule: Rule }[] = [];
  // Judges skip the per-IP scan caps (several judges may share a network) but keep the per-minute API cap.
  if (limits.ip && (!s.isJudge || route === "api")) {
    for (const rule of limits.ip) out.push({ key: `rl:ip:${s.ipHash}:${route}:${rule.windowSeconds}`, rule });
  }
  const sessionRules = s.isJudge ? limits.judgeSession : limits.session;
  for (const rule of sessionRules ?? []) {
    out.push({ key: `rl:sid:${s.sessionId}:${route}:${rule.windowSeconds}`, rule });
  }
  return out;
}

export async function checkLimit(
  store: CounterStore,
  route: LimitedRoute,
  subject: LimitSubject,
  now = Date.now(),
): Promise<LimitResult> {
  const rules = applicable(route, subject);
  const nowSec = now / 1000;

  const states = await Promise.all(
    rules.map(async ({ key, rule }) => {
      const w = rule.windowSeconds;
      const index = Math.floor(nowSec / w);
      const [cur, prev] = await Promise.all([store.get(`${key}:${index}`), store.get(`${key}:${index - 1}`)]);
      const elapsed = (nowSec % w) / w;
      const estimate = Number(prev ?? 0) * (1 - elapsed) + Number(cur ?? 0);
      return { key: `${key}:${index}`, rule, estimate, secondsLeft: w - (nowSec % w) };
    }),
  );

  const blocked = states.filter((s) => s.estimate + 1 > s.rule.limit);
  if (blocked.length > 0) {
    return { allowed: false, retryAfterSeconds: Math.ceil(Math.max(...blocked.map((b) => b.secondsLeft))) };
  }
  await Promise.all(states.map((s) => store.incrBy(s.key, 1, s.rule.windowSeconds * 2)));
  return { allowed: true };
}
