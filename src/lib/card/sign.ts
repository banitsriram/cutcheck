import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { hostname } from "node:os";
import { z } from "zod";
import { DENSITY_LEVELS, FRIZZ_LEVELS, HAIR_LENGTHS, HAIR_TYPES, type HairProfile } from "../hair/types";

// Barber card links: a compact payload (the cut id and the four reading values),
// HMAC-signed with CARD_SECRET into the URL. No server storage, no expiry, never a face or image.

const unknown = z.literal("?");
const payloadSchema = z
  .object({
    v: z.literal(1),
    c: z.string().regex(/^[a-z0-9-]{1,64}$/),
    t: z.union([z.enum(HAIR_TYPES), unknown]),
    l: z.union([z.enum(HAIR_LENGTHS), unknown]),
    f: z.union([z.enum(FRIZZ_LEVELS), unknown]),
    d: z.union([z.enum(DENSITY_LEVELS), unknown]),
  })
  .strict();

export type CardPayload = z.infer<typeof payloadSchema>;

function cardSecret(): string {
  const secret = process.env.CARD_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("CARD_SECRET is missing or shorter than 32 chars");
  return createHash("sha256").update(`cutcheck-card-dev-only:${hostname()}:${process.cwd()}`).digest("hex");
}

const mac = (body: string) => createHmac("sha256", cardSecret()).update(`card:${body}`).digest("base64url").slice(0, 32);

export function cardPayload(cutId: string, profile: HairProfile): CardPayload {
  const v = <T extends string>(r: { status: "ok"; value: T } | { status: "inconclusive" }): T | "?" =>
    r.status === "ok" ? r.value : "?";
  return { v: 1, c: cutId, t: v(profile.type), l: v(profile.length), f: v(profile.frizz), d: v(profile.density) };
}

/** `<base64url payload>.<mac>`, safe in a URL path segment. */
export function signCard(payload: CardPayload): string {
  const body = Buffer.from(JSON.stringify(payloadSchema.parse(payload))).toString("base64url");
  return `${body}.${mac(body)}`;
}

/** The payload if the signature holds, else null. */
export function verifyCard(sig: string): CardPayload | null {
  if (sig.length > 512) return null;
  const [body, tag, extra] = sig.split(".");
  if (!body || !tag || extra !== undefined) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(tag);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
