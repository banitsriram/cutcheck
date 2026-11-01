import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { poolKey, reserveUnits, setBreaker, settleUnits, type BudgetLimits } from "@/lib/security/budget";
import { MAX_UPLOAD_BYTES, sanitiseImage, sniffImageType } from "@/lib/security/image";
import { isSameOrigin } from "@/lib/security/origin";
import { checkLimit, hashIp, type LimitSubject } from "@/lib/security/ratelimit";
import { MemoryCounterStore } from "@/lib/security/store";

const T0 = Date.UTC(2026, 10, 3, 9, 0, 0); // 2026-11-03 09:00 UTC, first judging day

/** Store with a controllable clock. */
function clockedStore(start = T0) {
  let now = start;
  const store = new MemoryCounterStore(() => now);
  return { store, at: () => now, advance: (seconds: number) => (now += seconds * 1000) };
}

// ---------- store ----------

describe("MemoryCounterStore", () => {
  it("reserves up to the cap and refuses beyond it without writing", async () => {
    const { store } = clockedStore();
    expect(await store.reserve("k", 6, 10, 60)).toBe(6);
    expect(await store.reserve("k", 5, 10, 60)).toBeNull();
    expect(await store.get("k")).toBe("6");
    expect(await store.reserve("k", 4, 10, 60)).toBe(10);
  });

  it("expires keys after their TTL", async () => {
    const c = clockedStore();
    await c.store.incrBy("k", 1, 60);
    c.advance(61);
    expect(await c.store.get("k")).toBeNull();
  });
});

// ---------- rate limits ----------

describe("checkLimit", () => {
  const visitor = (n: number, ip = "ip-a"): LimitSubject => ({ ipHash: ip, sessionId: `s${n}`, isJudge: false });

  it("allows 2 scans per session per day, then refuses with Retry-After", async () => {
    const { store, at } = clockedStore();
    expect(await checkLimit(store, "scan", visitor(1), at())).toEqual({ allowed: true });
    expect(await checkLimit(store, "scan", visitor(1), at())).toEqual({ allowed: true });
    const third = await checkLimit(store, "scan", visitor(1), at());
    expect(third.allowed).toBe(false);
    if (!third.allowed) expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("caps scans per IP at 3/hour across sessions", async () => {
    const { store, at } = clockedStore();
    for (let i = 1; i <= 3; i++) expect((await checkLimit(store, "scan", visitor(i), at())).allowed).toBe(true);
    expect((await checkLimit(store, "scan", visitor(4), at())).allowed).toBe(false);
    expect((await checkLimit(store, "scan", visitor(5, "ip-b"), at())).allowed).toBe(true);
  });

  it("lets the hourly window slide back open", async () => {
    const c = clockedStore();
    for (let i = 1; i <= 3; i++) await checkLimit(c.store, "scan", visitor(i), c.at());
    c.advance(2 * 3600);
    expect((await checkLimit(c.store, "scan", visitor(9), c.at())).allowed).toBe(true);
  });

  it("does not count a refused request", async () => {
    const { store, at } = clockedStore();
    await checkLimit(store, "scan", visitor(1), at());
    await checkLimit(store, "scan", visitor(1), at());
    await checkLimit(store, "scan", visitor(1), at()); // refused by session rule
    // the IP rule saw only 2, so a fresh session on the same IP still gets one
    expect((await checkLimit(store, "scan", visitor(2), at())).allowed).toBe(true);
  });

  it("gives judges 10 scans/day and ignores the per-IP scan cap", async () => {
    const { store, at } = clockedStore();
    const judge: LimitSubject = { ipHash: "shared", sessionId: "j1", isJudge: true };
    for (let i = 0; i < 10; i++) expect((await checkLimit(store, "scan", judge, at())).allowed).toBe(true);
    expect((await checkLimit(store, "scan", judge, at())).allowed).toBe(false);
  });

  it("caps any visitor at 60 API requests a minute", async () => {
    const { store, at } = clockedStore();
    for (let i = 0; i < 60; i++) await checkLimit(store, "api", visitor(1), at());
    expect((await checkLimit(store, "api", visitor(1), at())).allowed).toBe(false);
  });
});

describe("hashIp", () => {
  it("is stable within a day, rotates daily, and never contains the IP", () => {
    const a = hashIp("203.0.113.7", "s".repeat(32), T0);
    expect(hashIp("203.0.113.7", "s".repeat(32), T0 + 3600_000)).toBe(a);
    expect(hashIp("203.0.113.7", "s".repeat(32), T0 + 86400_000)).not.toBe(a);
    expect(a).not.toContain("203");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
});

// ---------- unit ledger ----------

describe("unit ledger", () => {
  const limits: BudgetLimits = { publicDailyCap: 10, judgeCap: 400, disabled: false };

  it("reserves public units up to the daily cap", async () => {
    const { store, at } = clockedStore();
    expect((await reserveUnits(store, limits, "public", 8, at())).ok).toBe(true);
    expect(await reserveUnits(store, limits, "public", 3, at())).toEqual({ ok: false, reason: "budget_exhausted" });
  });

  it("resets the public pool on the next UTC day", async () => {
    const { store } = clockedStore();
    await reserveUnits(store, limits, "public", 10, T0);
    expect(poolKey("public", T0)).not.toBe(poolKey("public", T0 + 86400_000));
    expect((await reserveUnits(store, limits, "public", 10, T0 + 86400_000)).ok).toBe(true);
  });

  it("keeps the judge reserve separate from public traffic", async () => {
    const { store, at } = clockedStore();
    await reserveUnits(store, limits, "public", 10, at());
    expect((await reserveUnits(store, limits, "judge", 50, at())).ok).toBe(true);
  });

  it("settles to the actual charge and refunds uncharged failures", async () => {
    const { store, at } = clockedStore();
    const r = await reserveUnits(store, limits, "public", 6, at());
    if (!r.ok) throw new Error("expected reservation");
    await settleUnits(store, r.reservation, 0);
    expect(await store.get(r.reservation.key)).toBe("0");
    expect((await reserveUnits(store, limits, "public", 10, at())).ok).toBe(true);
  });

  it("open breaker → public refused, judges unaffected", async () => {
    const { store, at } = clockedStore();
    await setBreaker(store, true);
    expect(await reserveUnits(store, limits, "public", 1, at())).toEqual({ ok: false, reason: "breaker_open" });
    expect((await reserveUnits(store, limits, "judge", 1, at())).ok).toBe(true);
    await setBreaker(store, false);
    expect((await reserveUnits(store, limits, "public", 1, at())).ok).toBe(true);
  });

  it("kill switch refuses every pool", async () => {
    const { store, at } = clockedStore();
    const off = { ...limits, disabled: true };
    expect(await reserveUnits(store, off, "judge", 1, at())).toEqual({ ok: false, reason: "disabled" });
  });
});

// ---------- image sanitiser ----------

async function makeImage(width: number, height: number, format: "jpeg" | "png" | "webp" = "jpeg", exif = false) {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } } });
  if (exif) img = img.withExif({ IFD0: { Copyright: "secret-owner", Artist: "someone" } });
  return img.toFormat(format).toBuffer();
}

describe("sanitiseImage", () => {
  it("sniffs formats from magic bytes", async () => {
    expect(sniffImageType(await makeImage(4, 4, "jpeg"))).toBe("jpeg");
    expect(sniffImageType(await makeImage(4, 4, "png"))).toBe("png");
    expect(sniffImageType(await makeImage(4, 4, "webp"))).toBe("webp");
    expect(sniffImageType(Buffer.from("GIF89a......"))).toBeNull();
    expect(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });

  it("rejects non-images regardless of what the client claims", async () => {
    expect(await sanitiseImage(Buffer.from("not really a jpeg"))).toEqual({ ok: false, reason: "unsupported_type" });
  });

  it("rejects uploads over 4 MB before decoding", async () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_UPLOAD_BYTES)]);
    expect(await sanitiseImage(big)).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects images wider or taller than 4096 px", async () => {
    expect(await sanitiseImage(await makeImage(4100, 10))).toEqual({ ok: false, reason: "too_many_pixels" });
  });

  it("resizes to 1600 px on the longest side as JPEG", async () => {
    const r = await sanitiseImage(await makeImage(3000, 2000, "png"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([r.width, r.height]).toEqual([1600, 1067]);
    expect(sniffImageType(r.buffer)).toBe("jpeg");
  });

  it("does not enlarge small images", async () => {
    const r = await sanitiseImage(await makeImage(640, 480));
    expect(r.ok && [r.width, r.height]).toEqual([640, 480]);
  });

  it("strips all EXIF metadata", async () => {
    const input = await makeImage(800, 600, "jpeg", true);
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const r = await sanitiseImage(input);
    if (!r.ok) throw new Error("expected ok");
    const out = await sharp(r.buffer).metadata();
    expect(out.exif).toBeUndefined();
    expect(r.buffer.includes(Buffer.from("secret-owner"))).toBe(false);
  });
});

// ---------- origin ----------

describe("isSameOrigin", () => {
  const url = "https://cutcheck.example/api/scan";
  const h = (init: Record<string, string>) => new Headers(init);

  it("trusts Sec-Fetch-Site when present", () => {
    expect(isSameOrigin(h({ "sec-fetch-site": "same-origin" }), url)).toBe(true);
    expect(isSameOrigin(h({ "sec-fetch-site": "cross-site", origin: "https://cutcheck.example" }), url)).toBe(false);
    expect(isSameOrigin(h({ "sec-fetch-site": "same-site" }), url)).toBe(false);
  });

  it("falls back to the Origin header", () => {
    expect(isSameOrigin(h({ origin: "https://cutcheck.example" }), url)).toBe(true);
    expect(isSameOrigin(h({ origin: "https://evil.example" }), url)).toBe(false);
  });

  it("refuses requests with neither header", () => {
    expect(isSameOrigin(h({}), url)).toBe(false);
  });
});
