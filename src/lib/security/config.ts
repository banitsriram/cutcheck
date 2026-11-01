import "server-only";
import { z } from "zod";

// Server-side configuration read from env (.env.example). Parsed once, lazily,
// so a missing optional service only fails the code path that needs it.

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_SECRET: z.string().min(32).optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // A 40-unit account, so public traffic gets demo mode and judges get the reserve.
  PUBLIC_DAILY_UNIT_CAP: z.coerce.number().int().nonnegative().default(0),
  JUDGE_UNIT_CAP: z.coerce.number().int().nonnegative().default(26),
  YOUCAM_DISABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type ServerConfig = z.infer<typeof envSchema>;

let cached: ServerConfig | undefined;

export function serverConfig(): ServerConfig {
  const env = process.env;
  // The Vercel Marketplace Upstash integration names these KV_REST_API_*.
  cached ??= envSchema.parse({
    ...env,
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN,
  });
  return cached;
}

/** For tests only: forget the parsed env so a changed process.env is re-read. */
export function resetServerConfigForTests(): void {
  cached = undefined;
}
