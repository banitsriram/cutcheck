import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapDensity, mapFrizz, mapHairLength, mapHairType, readFrizz, readHairType } from "@/lib/youcam/mappers";
import { TASK_UNITS, youcamAnalyzer } from "@/lib/youcam/client";

// Mappers use the observed response shapes (docs/api-samples); the client runs against a fake
// YouCam so tests never spend units or need a key.

describe("mappers", () => {
  it("maps hair type ranges by the lower bound, case-insensitively", () => {
    expect(mapHairType("4B to 4C")).toBe("coily");
    expect(mapHairType("1 to 2a")).toBe("straight");
    expect(mapHairType("2c to 3a")).toBe("wavy");
    expect(mapHairType("3c to 4a")).toBe("curly");
    expect(mapHairType("nonsense")).toBeNull();
  });

  it("maps overall length terms", () => {
    expect(mapHairLength("above the ears")).toBe("short");
    expect(mapHairLength("ear length")).toBe("medium");
    expect(mapHairLength("Ear length or longer")).toBe("medium");
    expect(mapHairLength("short hair")).toBe("medium");
    expect(mapHairLength("above chest")).toBe("long");
    expect(mapHairLength("long hair")).toBe("long");
    expect(mapHairLength("chin")).toBeNull();
  });

  it("maps frizz 0–1 low, 2 medium, 3 high", () => {
    expect([0, 1, 2, 3, 4].map(mapFrizz)).toEqual(["low", "low", "medium", "high", null]);
  });

  it("maps density terms", () => {
    expect(mapDensity("Extremely Low Density")).toBe("low");
    expect(mapDensity("Medium Density")).toBe("medium");
    expect(mapDensity("High Density")).toBe("high");
  });

  it("turns observed task results into readings with YouCam's term", () => {
    expect(
      readHairType({
        task_status: "success",
        results: { hair_type: { mapping: "4B to 4C", term: "Coily to Extremely Coily" } },
      }),
    ).toEqual({ status: "ok", value: "coily", source: "api", term: "Coily to Extremely Coily" });
    expect(readFrizz({ task_status: "success", results: { hair_frizziness: { mapping: 2, term: "Frizzy" } } })).toEqual({
      status: "ok",
      value: "medium",
      source: "api",
      term: "Frizzy",
    });
  });

  it("separates photo problems from service failures", () => {
    expect(readHairType({ task_status: "error", error: "error_no_face" })).toEqual({ status: "inconclusive", reason: "unclear_photo" });
    expect(readHairType({ task_status: "error", error: "unknown_internal_error" })).toEqual({
      status: "inconclusive",
      reason: "api_error",
    });
    expect(readHairType(null)).toEqual({ status: "inconclusive", reason: "api_error" });
    expect(readHairType({ task_status: "success", results: { hair_type: { mapping: "9z" } } })).toEqual({
      status: "inconclusive",
      reason: "not_detected",
    });
  });
});

// ---------- client against a fake YouCam ----------

type Handler = (url: URL, init: RequestInit) => { status?: number; body?: unknown };

function fakeYouCam(handler: Handler) {
  const calls: { method: string; path: string; body: unknown; auth: string | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const headers = new Headers(init.headers);
      calls.push({
        method: init.method ?? "GET",
        path: url.pathname,
        body: typeof init.body === "string" ? JSON.parse(init.body) : null,
        auth: headers.get("authorization"),
      });
      const { status = 200, body = {} } = handler(url, init);
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }),
  );
  return calls;
}

let fileCounter = 0;
const fileCreate = () => ({
  data: { files: [{ file_id: `f${++fileCounter}`, requests: [{ url: "https://upload.test/put", method: "PUT", headers: {} }] }] },
});

const RESULTS: Record<string, unknown> = {
  "hair-type-detection": { hair_type: { mapping: "4B to 4C", term: "Coily to Extremely Coily" } },
  "hair-frizziness-detection": { hair_frizziness: { mapping: 2, term: "Frizzy" } },
  "hair-length-detection": { hair_length: { term: "ear length" } },
};

function standardHandler(densityError = "error_no_face"): Handler {
  return (url, init) => {
    if (url.hostname === "upload.test") return {};
    if (url.pathname === "/s2s/v2.0/file") return { body: fileCreate() };
    const m = url.pathname.match(/^\/s2s\/v2\.0\/task\/([a-z-]+)(?:\/(.+))?$/);
    if (!m) return { status: 404 };
    const [, feature, taskId] = m;
    if (!taskId && init.method === "POST") return { body: { data: { task_id: `t-${feature}` } } };
    if (feature === "hair-density-detection") return { body: { data: { task_status: "error", error: densityError } } };
    return { body: { data: { task_status: "success", results: RESULTS[feature] } } };
  };
}

describe("YouCam client (fake server)", () => {
  // Generated per run so no key-like literal sits in the repo (gitleaks rule).
  const fakeKey = randomBytes(12).toString("hex");
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 50 });
    process.env.YOUCAM_API_KEY = fakeKey;
    process.env.YOUCAM_BASE_URL = "https://youcam.test";
    fileCounter = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.YOUCAM_API_KEY;
    delete process.env.YOUCAM_BASE_URL;
  });

  const shots = () => ({
    front: Buffer.from("front"),
    left: Buffer.from("left"),
    right: Buffer.from("right"),
  });

  it("uploads three shots, sends the observed bodies, and charges only successful tasks", async () => {
    const calls = fakeYouCam(standardHandler());
    const run = youcamAnalyzer.analyze(shots());
    await vi.runAllTimersAsync();
    const result = await run;

    expect(result.readings.type).toMatchObject({ status: "ok", value: "coily" });
    expect(result.readings.frizz).toMatchObject({ status: "ok", value: "medium" });
    expect(result.readings.length).toMatchObject({ status: "ok", value: "medium" });
    expect(result.readings.density).toEqual({ status: "inconclusive", reason: "manual" });
    expect(result.unitsCharged).toBe(TASK_UNITS.type + TASK_UNITS.frizz + TASK_UNITS.length);
    expect(result.fileRef).toBe("f1");
    expect(result.taskIds).toHaveLength(3);

    const creates = calls.filter((c) => c.method === "POST" && c.path.startsWith("/s2s/v2.0/task/"));
    const body = (feature: string) => creates.find((c) => c.path.endsWith(feature))?.body;
    // front, right, left: the order YouCam expects
    expect(body("hair-type-detection")).toEqual({ src_file_ids: ["f1", "f3", "f2"] });
    expect(body("hair-frizziness-detection")).toEqual({ src_file_ids: ["f1", "f3", "f2"] });
    expect(body("hair-length-detection")).toEqual({ src_file_id: "f1" });
    expect(body("hair-density-detection")).toBeUndefined();
    expect(calls.filter((c) => c.path.startsWith("/s2s")).every((c) => c.auth === `Bearer ${fakeKey}`)).toBe(true);
  });

  it("retries type and frizz once with left/right swapped when YouCam rejects the angle", async () => {
    const base = standardHandler();
    const calls = fakeYouCam((url, init) => {
      const m = url.pathname.match(/task\/(hair-(?:type|frizziness)-detection)(?:\/(.+))?$/);
      if (m && !m[2]) {
        const ids = JSON.parse(String(init.body)).src_file_ids as string[];
        return { body: { data: { task_id: `${m[1]}:${ids.join(",")}` } } };
      }
      if (m?.[2]?.endsWith("f1,f3,f2")) return { body: { data: { task_status: "error", error: "error_face_angle_invalid" } } };
      return base(url, init);
    });
    const run = youcamAnalyzer.analyze(shots());
    await vi.runAllTimersAsync();
    const result = await run;

    expect(result.readings.type).toMatchObject({ status: "ok", value: "coily" });
    expect(result.readings.frizz).toMatchObject({ status: "ok", value: "medium" });
    expect(result.unitsCharged).toBe(TASK_UNITS.type + TASK_UNITS.frizz + TASK_UNITS.length);
    expect(result.taskIds).toHaveLength(5); // the two rejected tasks are deleted too
    const typeBodies = calls.filter((c) => c.method === "POST" && c.path.endsWith("hair-type-detection")).map((c) => c.body);
    expect(typeBodies).toEqual([{ src_file_ids: ["f1", "f3", "f2"] }, { src_file_ids: ["f1", "f2", "f3"] }]);
  });

  it("never retries a 4xx task create (it would repeat a bad request)", async () => {
    const calls = fakeYouCam((url, init) => {
      if (url.pathname.startsWith("/s2s/v2.0/task/") && init.method === "POST") {
        return { status: 400, body: { error_code: "InvalidParameters" } };
      }
      return standardHandler()(url, init);
    });
    const run = youcamAnalyzer.analyze(shots());
    await vi.runAllTimersAsync();
    const result = await run;
    const creates = calls.filter((c) => c.method === "POST" && c.path.startsWith("/s2s/v2.0/task/"));
    expect(creates).toHaveLength(3);
    expect(result.unitsCharged).toBe(0);
    expect(Object.values(result.readings).every((r) => r.status === "inconclusive")).toBe(true);
  });

  it("gives up at the deadline and settles a still-running task conservatively", async () => {
    fakeYouCam((url, init) => {
      if (url.pathname === "/s2s/v2.0/task/hair-frizziness-detection/t-hair-frizziness-detection") {
        return { body: { data: { task_status: "running" } } };
      }
      return standardHandler("unknown_internal_error")(url, init);
    });
    const run = youcamAnalyzer.analyze(shots());
    await vi.runAllTimersAsync();
    const result = await run;
    expect(result.readings.frizz).toEqual({ status: "inconclusive", reason: "api_error" });
    expect(result.readings.density).toEqual({ status: "inconclusive", reason: "manual" });
    expect(result.unitsCharged).toBe(TASK_UNITS.type + TASK_UNITS.length + TASK_UNITS.frizz);
  });
});
