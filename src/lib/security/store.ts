import "server-only";
import { Redis } from "@upstash/redis";
import { serverConfig } from "./config";

// Counter store behind rate limits, the unit ledger and short-lived refs.
// Upstash Redis in deployed environments; an in-memory map only for local dev and tests.

export interface CounterStore {
  /** Atomically add `amount` unless the result would exceed `cap`. Returns the new total, or null if refused. */
  reserve(key: string, amount: number, cap: number, ttlSeconds: number): Promise<number | null>;
  /** Add `amount` (may be negative) and return the new total. Sets the TTL if the key is new. */
  incrBy(key: string, amount: number, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

// KEYS[1] = counter, ARGV = amount, cap, ttl. Refuses without writing when over cap.
const RESERVE_LUA = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[1])
if current + amount > tonumber(ARGV[2]) then return -1 end
local total = redis.call('INCRBY', KEYS[1], amount)
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[3]) end
return total
`;

const INCR_LUA = `
local total = redis.call('INCRBY', KEYS[1], ARGV[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return total
`;

export class RedisCounterStore implements CounterStore {
  constructor(private readonly redis: Redis) {}

  async reserve(key: string, amount: number, cap: number, ttlSeconds: number) {
    const result = await this.redis.eval<[number, number, number], number>(RESERVE_LUA, [key], [amount, cap, ttlSeconds]);
    return result < 0 ? null : result;
  }

  async incrBy(key: string, amount: number, ttlSeconds: number) {
    return this.redis.eval<[number, number], number>(INCR_LUA, [key], [amount, ttlSeconds]);
  }

  async get(key: string) {
    const v = await this.redis.get<string | number>(key);
    return v === null ? null : String(v);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(key, value, { ex: ttlSeconds });
    else await this.redis.set(key, value);
  }

  async del(...keys: string[]) {
    if (keys.length) await this.redis.del(...keys);
  }
}

export class MemoryCounterStore implements CounterStore {
  private readonly data = new Map<string, { value: string; expiresAt: number | null }>();

  constructor(private readonly now: () => number = Date.now) {}

  private live(key: string) {
    const entry = this.data.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }

  async reserve(key: string, amount: number, cap: number, ttlSeconds: number) {
    const current = Number(this.live(key)?.value ?? 0);
    if (current + amount > cap) return null;
    return this.incrBy(key, amount, ttlSeconds);
  }

  async incrBy(key: string, amount: number, ttlSeconds: number) {
    const entry = this.live(key);
    const total = Number(entry?.value ?? 0) + amount;
    this.data.set(key, {
      value: String(total),
      expiresAt: entry?.expiresAt ?? this.now() + ttlSeconds * 1000,
    });
    return total;
  }

  async get(key: string) {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    this.data.set(key, { value, expiresAt: ttlSeconds ? this.now() + ttlSeconds * 1000 : null });
  }

  async del(...keys: string[]) {
    for (const k of keys) this.data.delete(k);
  }
}

let shared: CounterStore | undefined;

/** For tests only: start the next counterStore() call from an empty store. */
export function resetCounterStoreForTests(): void {
  shared = undefined;
}

/**
 * The process-wide store. Production refuses to fall back to memory: serverless
 * instances don't share memory, so limits and budgets would silently not hold.
 */
export function counterStore(): CounterStore {
  if (shared) return shared;
  const cfg = serverConfig();
  if (cfg.UPSTASH_REDIS_REST_URL && cfg.UPSTASH_REDIS_REST_TOKEN) {
    shared = new RedisCounterStore(new Redis({
        url: cfg.UPSTASH_REDIS_REST_URL,
        token: cfg.UPSTASH_REDIS_REST_TOKEN,
        // We store JSON as strings and parse it ourselves; auto-parsing turned it into "[object Object]".
        automaticDeserialization: false,
      }));
  } else if (cfg.NODE_ENV === "production") {
    throw new Error("Upstash Redis is not configured");
  } else {
    shared = new MemoryCounterStore();
  }
  return shared;
}
