import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as scan } from "@/app/api/scan/route";
import { POST as verdict } from "@/app/api/verdict/route";
import { hairProfileSchema, SHOTS } from "@/lib/hair/types";
import { getFileRef } from "@/lib/security/refs";
import {
  JUDGE_COOKIE,
  newJudgeToken,
  newSessionToken,
  SESSION_COOKIE,
  verifyJudgeToken,
  verifySessionToken,
} from "@/lib/security/session";
import { counterStore, resetCounterStoreForTests } from "@/lib/security/store";
import { proxy } from "@/proxy";

const ORIGIN = "http://localhost:3000";

beforeEach(() => {
  resetCounterStoreForTests();
});

async function selfie(seed = 1) {
  return sharp({ create: { width: 640, height: 800, channels: 3, background: { r: seed * 40, g: 80, b: 60 } } })
    .jpeg()
    .toBuffer();
}

/** Scan form: the same image as all three shots (or only `shots`); reupload sends it as `image`. */
function scanRequest(
  image: Buffer | null,
  opts: {
    cookie?: string;
    extra?: Record<string, string>;
    ip?: string;
    shots?: readonly string[];
    reupload?: boolean;
    alsoImage?: boolean;
  } = {},
) {
  const form = new FormData();
  const blob = () => new Blob([new Uint8Array(image!)], { type: "image/jpeg" });
  if (image && opts.reupload) form.append("image", blob(), "front.jpg");
  else if (image) for (const shot of opts.shots ?? SHOTS) form.append(shot, blob(), `${shot}.jpg`);
  if (image && opts.alsoImage) form.append("image", blob(), "front.jpg");
  if (opts.reupload) form.append("mode", "reupload");
  for (const [k, v] of Object.entries(opts.extra ?? {})) form.append(k, v);
  return new Request(`${ORIGIN}/api/scan`, {
    method: "POST",
    body: form,
    headers: { ...(opts.cookie ? { cookie: opts.cookie } : {}), "x-forwarded-for": opts.ip ?? "198.51.100.1" },
  });
}

const sessionCookie = (token = newSessionToken()) => `${SESSION_COOKIE}=${token}`;
const sidOf = (cookie: string) => verifySessionToken(cookie.split("=")[1])!;

// ---------- session tokens ----------

describe("session tokens", () => {
  it("round-trips and rejects tampering", () => {
    const t = newSessionToken();
    expect(verifySessionToken(t)).toMatch(/^[0-9a-f]{32}$/);
    expect(verifySessionToken(t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(verifySessionToken(`${"0".repeat(32)}.forged`)).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });

  it("expires judge passes", () => {
    const now = Date.now();
    const t = newJudgeToken(now);
    expect(verifyJudgeToken(t, now)).toBe(true);
    expect(verifyJudgeToken(t, now + 31 * 86400_000)).toBe(false);
  });
});

// ---------- proxy ----------

describe("proxy", () => {
  it("issues a signed session cookie on first visit", () => {
    const res = proxy(new NextRequest(`${ORIGIN}/`));
    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(verifySessionToken(cookie?.value)).not.toBeNull();
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/" });
  });

  it("leaves a valid session alone", () => {
    const res = proxy(new NextRequest(`${ORIGIN}/`, { headers: { cookie: sessionCookie() } }));
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("blocks cross-site writes to the API", async () => {
    const res = proxy(
      new NextRequest(`${ORIGIN}/api/scan`, { method: "POST", headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(res.status).toBe(403);
  });

  it("redirects ?k= to a clean URL, setting the judge cookie only for the right code", () => {
    // Generated per run so no code-like literal ever sits in the repo.
    const code = randomBytes(24).toString("base64url");
    process.env.JUDGE_CODE = code;
    const good = proxy(new NextRequest(`${ORIGIN}/scan?k=${code}&x=1`));
    expect(good.status).toBe(303);
    expect(good.headers.get("location")).toBe(`${ORIGIN}/scan?x=1`);
    expect(verifyJudgeToken(good.cookies.get(JUDGE_COOKIE)?.value)).toBe(true);

    const bad = proxy(new NextRequest(`${ORIGIN}/scan?k=wrong`));
    expect(bad.status).toBe(303);
    expect(bad.headers.get("location")).toBe(`${ORIGIN}/scan`);
    expect(bad.cookies.get(JUDGE_COOKIE)).toBeUndefined();
    delete process.env.JUDGE_CODE;
  });
});

// ---------- /api/scan ----------

describe("POST /api/scan (mock analyzer)", () => {
  // Tests never reach YouCam, even if a developer has a key in their shell.
  const saved = { key: process.env.YOUCAM_API_KEY, base: process.env.YOUCAM_BASE_URL };
  beforeAll(() => {
    delete process.env.YOUCAM_API_KEY;
    delete process.env.YOUCAM_BASE_URL;
  });
  afterAll(() => {
    if (saved.key !== undefined) process.env.YOUCAM_API_KEY = saved.key;
    if (saved.base !== undefined) process.env.YOUCAM_BASE_URL = saved.base;
  });

  it("returns a valid HairProfile and stores the file ref, never the image", async () => {
    const cookie = sessionCookie();
    const res = await scan(scanRequest(await selfie(), { cookie }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.source).toBe("mock");
    expect(hairProfileSchema.safeParse(body.profile).success).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/base64|data:image|fileRef|mock-file/);
    expect(await getFileRef(counterStore(), sidOf(cookie))).toMatch(/^mock-file-/);
  });

  it("is deterministic for the same photo", async () => {
    const a = await (await scan(scanRequest(await selfie(2), { cookie: sessionCookie() }))).json();
    const b = await (await scan(scanRequest(await selfie(2), { cookie: sessionCookie(), ip: "198.51.100.2" }))).json();
    const strip = (p: Record<string, unknown>) => ({ ...p, scannedAt: undefined });
    expect(strip(a.profile)).toEqual(strip(b.profile));
  });

  it("requires a session", async () => {
    const res = await scan(scanRequest(await selfie()));
    expect(res.status).toBe(401);
  });

  it("rejects non-images, missing images and unknown fields", async () => {
    const cookie = sessionCookie();
    const fake = await scan(scanRequest(Buffer.from("<script>alert(1)</script>"), { cookie }));
    expect(fake.status).toBe(422);
    expect(await fake.json()).toEqual({ error: "image_rejected", detail: "unsupported_type" });
    expect((await scan(scanRequest(null, { cookie }))).status).toBe(400);
    expect((await scan(scanRequest(await selfie(), { cookie, extra: { imageUrl: "https://x" } }))).status).toBe(400);
  });

  it("needs all three shots for a scan, and only `image` for a reupload", async () => {
    const cookie = sessionCookie();
    const img = await selfie();
    expect((await scan(scanRequest(img, { cookie, shots: ["front", "left"] }))).status).toBe(400);
    expect((await scan(scanRequest(img, { cookie, shots: ["front", "left", "right", "down"] }))).status).toBe(400);
    expect((await scan(scanRequest(img, { cookie, alsoImage: true }))).status).toBe(400);
    const re = await scan(scanRequest(img, { cookie, reupload: true }));
    expect(re.status).toBe(200);
    expect(await re.json()).toEqual({ ok: true });
  });

  it("enforces 2 scans per session per day with Retry-After", async () => {
    const cookie = sessionCookie();
    expect((await scan(scanRequest(await selfie(), { cookie }))).status).toBe(200);
    expect((await scan(scanRequest(await selfie(), { cookie }))).status).toBe(200);
    const third = await scan(scanRequest(await selfie(), { cookie }));
    expect(third.status).toBe(429);
    expect(Number(third.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("lets a judge scan beyond the public session limit", async () => {
    const cookie = `${sessionCookie()}; ${JUDGE_COOKIE}=${newJudgeToken()}`;
    for (let i = 0; i < 3; i++) expect((await scan(scanRequest(await selfie(), { cookie }))).status).toBe(200);
  });

  it("switches to demo (budget_exhausted) when the kill switch is on", async () => {
    process.env.YOUCAM_DISABLED = "true";
    try {
      const res = await scan(scanRequest(await selfie(), { cookie: sessionCookie() }));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "budget_exhausted" });
    } finally {
      delete process.env.YOUCAM_DISABLED;
    }
  });
});

// ---------- /api/verdict ----------

describe("POST /api/verdict", () => {
  const profile = {
    type: { status: "ok", value: "curly", source: "api" },
    length: { status: "ok", value: "short", source: "api" },
    frizz: { status: "ok", value: "high", source: "api" },
    density: { status: "ok", value: "medium", source: "api" },
    scannedAt: "2026-10-30T10:00:00.000Z",
  };
  const post = (body: unknown, cookie: string | null = sessionCookie(), query = "") =>
    verdict(
      new Request(`${ORIGIN}/api/verdict${query}`, {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      }),
    );

  it("returns a verdict for every cut", async () => {
    const res = await post(profile);
    expect(res.status).toBe(200);
    const { verdicts } = await res.json();
    expect(verdicts.length).toBeGreaterThanOrEqual(8);
    expect(verdicts.find((v: { cutId: string }) => v.cutId === "curtains").verdict).toBe("no");
  });

  it("limits the board to the chosen audience, ignoring unknown values", async () => {
    const ids = async (q: string) => ((await (await post(profile, sessionCookie(), q)).json()).verdicts as { cutId: string }[]).map((v) => v.cutId);
    const women = await ids("?audience=women");
    expect(women).toContain("blunt-bob");
    expect(women).toContain("wolf-cut");
    expect(women).not.toContain("buzz-cut");
    expect((await ids("?audience=x")).length).toBe((await ids("")).length);
  });

  it("rejects bad JSON, unknown keys, oversized bodies and missing sessions", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ ...profile, admin: true })).status).toBe(400);
    expect((await post({ ...profile, pad: "x".repeat(17 * 1024) })).status).toBe(400);
    expect((await post(profile, null)).status).toBe(401);
  });
});
