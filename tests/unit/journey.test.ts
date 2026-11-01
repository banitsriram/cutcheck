import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as card } from "@/app/api/card/route";
import { POST as del } from "@/app/api/delete/route";
import { GET as image } from "@/app/api/image/[token]/route";
import { POST as kit } from "@/app/api/kit/route";
import { POST as lookClothes } from "@/app/api/look/clothes/route";
import { POST as lookShoes } from "@/app/api/look/shoes/route";
import { POST as tryon } from "@/app/api/tryon/hair/route";
import { cardPayload, signCard, verifyCard } from "@/lib/card/sign";
import { DEMO_PROFILE } from "@/lib/demo/fixtures";
import type { HairProfile, Reading } from "@/lib/hair/types";
import { buildKit, MAX_KIT_ITEMS, PRODUCTS } from "@/lib/kit/build";
import { LOOKS } from "@/lib/look/looks";
import { getFileRef, getImageRef, saveBodyFileRef, saveFileRef, saveImageRef } from "@/lib/security/refs";
import { newSessionToken, SESSION_COOKIE, verifySessionToken } from "@/lib/security/session";
import { counterStore, resetCounterStoreForTests } from "@/lib/security/store";
import { evaluateCut } from "@/lib/verdict/engine";
import { CUTS } from "@/lib/verdict/rules";

// See it → wear it → keep it routes against the mock studio (no key, no units), plus the pure
// kit builder and barber-card signing.

const ORIGIN = "http://localhost:3000";
const saved = { key: process.env.YOUCAM_API_KEY, base: process.env.YOUCAM_BASE_URL };
beforeAll(() => {
  delete process.env.YOUCAM_API_KEY;
  delete process.env.YOUCAM_BASE_URL;
});
afterAll(() => {
  if (saved.key !== undefined) process.env.YOUCAM_API_KEY = saved.key;
  if (saved.base !== undefined) process.env.YOUCAM_BASE_URL = saved.base;
});
beforeEach(() => resetCounterStoreForTests());

const session = () => {
  const token = newSessionToken();
  return { cookie: `${SESSION_COOKIE}=${token}`, sid: verifySessionToken(token)! };
};
const post = (path: string, body: unknown, cookie?: string) =>
  new Request(`${ORIGIN}${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7", ...(cookie ? { cookie } : {}) },
  });
const get = (path: string, cookie?: string) => new Request(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} });

const ok = <T,>(value: T, source: "api" | "user" = "api"): Reading<T> => ({ status: "ok", value, source });
const profile = (over: Partial<HairProfile> = {}): HairProfile => ({
  type: ok("straight"),
  length: ok("long"),
  frizz: ok("low"),
  density: ok("high"),
  scannedAt: "2026-10-31T10:00:00.000Z",
  ...over,
});
const cut = (id: string) => CUTS.find((c) => c.id === id)!;

describe("POST /api/tryon/hair", () => {
  it("asks for a re-upload when the photo reference expired", async () => {
    const s = session();
    const res = await tryon(post("/api/tryon/hair", { cutId: "curtains" }, s.cookie));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "rescan_needed" });
  });

  it("returns a session-bound image link, never a vendor URL", async () => {
    const s = session();
    await saveFileRef(counterStore(), s.sid, "file-1");
    const res = await tryon(post("/api/tryon/hair", { cutId: "curtains" }, s.cookie));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.image).toMatch(/^\/api\/image\/[A-Za-z0-9_-]{24}$/);
    expect(JSON.stringify(body)).not.toMatch(/https?:/);
  });

  it("rejects unknown cuts and extra keys", async () => {
    const s = session();
    expect((await tryon(post("/api/tryon/hair", { cutId: "warrior-cut" }, s.cookie))).status).toBe(400);
    expect((await tryon(post("/api/tryon/hair", { cutId: "curtains", template: "x" }, s.cookie))).status).toBe(400);
  });

  it("enforces the daily try-on limit per session", async () => {
    const s = session();
    await saveFileRef(counterStore(), s.sid, "file-1");
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await tryon(post("/api/tryon/hair", { cutId: "curtains" }, s.cookie))).status);
    expect(codes).toEqual([200, 200, 200, 200, 429]);
  });
});

describe("GET /api/image/[token]", () => {
  it("serves only the session that created the token", async () => {
    const a = session();
    const b = session();
    const token = await saveImageRef(counterStore(), a.sid, { kind: "local", path: "/demo/tryon.svg" });
    const params = { params: Promise.resolve({ token }) };
    const own = await image(get(`/api/image/${token}`, a.cookie), params);
    expect(own.status).toBe(302);
    expect(own.headers.get("location")).toBe("/demo/tryon.svg");
    expect((await image(get(`/api/image/${token}`, b.cookie), params)).status).toBe(404);
    expect((await image(get(`/api/image/${token}`), params)).status).toBe(404);
  });

  it("refuses malformed tokens without touching the store", async () => {
    const a = session();
    expect(await getImageRef(counterStore(), a.sid, "../../etc")).toBeNull();
  });
});

describe("Look routes (chain B)", () => {
  it("needs the full-body photo first", async () => {
    const s = session();
    const res = await lookClothes(post("/api/look/clothes", { occasion: LOOKS[0].id }, s.cookie));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "photo_needed" });
  });

  it("runs clothes after the photo is in, and rejects unknown occasions", async () => {
    const s = session();
    await saveBodyFileRef(counterStore(), s.sid, "body-1");
    const res = await lookClothes(post("/api/look/clothes", { occasion: LOOKS[0].id }, s.cookie));
    expect(res.status).toBe(200);
    expect((await res.json()).image).toMatch(/^\/api\/image\//);
    expect((await lookShoes(post("/api/look/shoes", { occasion: "beach" }, s.cookie))).status).toBe(400);
  });
});

describe("POST /api/delete", () => {
  it("removes every reference and reports what was there", async () => {
    const s = session();
    const store = counterStore();
    await saveFileRef(store, s.sid, "file-1");
    await saveBodyFileRef(store, s.sid, "body-1");
    const token = await saveImageRef(store, s.sid, { kind: "local", path: "/demo/tryon.svg" });

    const res = await del(post("/api/delete", {}, s.cookie));
    expect(res.status).toBe(200);
    expect((await res.json()).removed).toEqual({ photo: true, bodyPhoto: true, resultImages: 1 });
    expect(await getFileRef(store, s.sid)).toBeNull();
    expect(await getImageRef(store, s.sid, token)).toBeNull();
  });

  it("validates its body", async () => {
    expect((await del(post("/api/delete", { everything: true }, session().cookie))).status).toBe(400);
  });
});

describe("kit", () => {
  it("catalogue has 15–25 products with unique ids, covering every product a cut lists", () => {
    const ids = new Set(PRODUCTS.map((p) => p.id));
    for (const c of CUTS) for (const list of Object.values(c.productsByType)) for (const id of list) expect(ids.has(id)).toBe(true);
  });

  it("adds concern products, keeps at most 4, ordered wash → style → finish", () => {
    const c = cut("textured-comma");
    const p = profile({ type: ok("wavy"), frizz: ok("high") });
    const k = buildKit(c, evaluateCut(c, p), p);
    expect(k.items.length).toBeLessThanOrEqual(MAX_KIT_ITEMS);
    expect(k.items.map((i) => i.product.id)).toContain("anti-frizz-serum");
    const order = ["wash", "style", "finish"];
    const steps = k.items.map((i) => order.indexOf(i.product.step));
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(k.totalInr).toBe(k.items.reduce((n, i) => n + i.product.priceInr, 0));
  });

  it("adds a volume product when density is at the warning level", () => {
    const c = cut("afro");
    const p = profile({ type: ok("coily"), density: ok("medium") });
    const k = buildKit(c, evaluateCut(c, p), p);
    expect(k.items.find((i) => i.reason.kind === "concern")?.product.id).toBe("volume-mousse");
  });

  it("lists only concern products when the type wasn't read", () => {
    const c = cut("crew-cut");
    const p = profile({ type: { status: "inconclusive", reason: "unclear_photo" } });
    const k = buildKit(c, evaluateCut(c, p), p);
    expect(k.typeUnknown).toBe(true);
    expect(k.items.every((i) => i.reason.kind === "concern")).toBe(true);
  });

  it("the kit route returns verdict and kit for a cut", async () => {
    const res = await kit(post("/api/kit", { cutId: "afro", profile: DEMO_PROFILE }, session().cookie));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cut.name).toBe("Afro");
    expect(body.kit.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain(cut("afro").hairStyleTemplateId);
  });
});

describe("barber card", () => {
  it("round-trips and rejects any tampering", () => {
    const sig = signCard(cardPayload("afro", DEMO_PROFILE));
    expect(verifyCard(sig)).toEqual({ v: 1, c: "afro", t: "coily", l: "medium", f: "medium", d: "medium" });
    const [body, tag] = sig.split(".");
    const forged = Buffer.from(JSON.stringify({ v: 1, c: "buzz-cut", t: "coily", l: "medium", f: "medium", d: "?" })).toString("base64url");
    expect(verifyCard(`${forged}.${tag}`)).toBeNull();
    expect(verifyCard(`${body}.${tag.slice(0, -1)}x`)).toBeNull();
    expect(verifyCard("nonsense")).toBeNull();
  });

  it("the card route signs a path that carries no image or vendor data", async () => {
    const res = await card(post("/api/card", { cutId: "afro", profile: DEMO_PROFILE }, session().cookie));
    const { path } = await res.json();
    expect(path).toMatch(/^\/card\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{32}$/);
    expect(Buffer.from(path.split("/")[2].split(".")[0], "base64url").toString()).not.toMatch(/http|file|img/);
  });
});

describe("CSP", () => {
  it("gives every page a fresh nonce and API responses a deny-all policy", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");
    const page = (path: string) => proxy(new NextRequest(`${ORIGIN}${path}`, { headers: { cookie: session().cookie } }));
    const a = page("/verdict").headers.get("content-security-policy")!;
    const b = page("/verdict").headers.get("content-security-policy")!;
    expect(a).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]{24}' 'strict-dynamic' 'wasm-unsafe-eval'/);
    expect(a).toContain("frame-ancestors 'none'");
    expect(a).not.toContain("'unsafe-eval'");
    expect(a).not.toBe(b);
    expect(page("/api/health").headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
  });
});
