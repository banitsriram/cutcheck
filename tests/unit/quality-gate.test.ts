import { describe, expect, it } from "vitest";
import {
  centreBrightness,
  checkFraming,
  checkQuality,
  GATE,
  laplacianVariance,
  toGrey,
  type FaceBox,
} from "@/lib/client/quality-gate";

/** RGBA image filled by a per-pixel grey function. */
function image(width: number, height: number, grey: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const g = grey(x, y);
      data[i] = data[i + 1] = data[i + 2] = g;
      data[i + 3] = 255;
    }
  return { data, width, height };
}

const checker = (x: number, y: number) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 200 : 40); // sharp, mid-bright
const big = { width: 1200, height: 1600 };

describe("quality gate maths", () => {
  it("computes luma", () => {
    const g = toGrey(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]), 2, 1);
    expect(g[0]).toBeCloseTo(76.245);
    expect(g[1]).toBeCloseTo(149.685);
  });

  it("measures brightness over the centre only", () => {
    const img = image(10, 10, (x, y) => (x >= 2 && x < 8 && y >= 2 && y < 8 ? 100 : 0));
    expect(centreBrightness(toGrey(img.data, 10, 10), 10, 10)).toBe(100);
  });

  it("scores a flat image as blurry and a checkerboard as sharp", () => {
    const flat = image(64, 64, () => 128);
    const sharp = image(64, 64, checker);
    expect(laplacianVariance(toGrey(flat.data, 64, 64), 64, 64)).toBe(0);
    expect(laplacianVariance(toGrey(sharp.data, 64, 64), 64, 64)).toBeGreaterThan(GATE.minSharpness);
  });
});

describe("checkQuality", () => {
  it("passes a sharp, well-lit, large photo", () => {
    expect(checkQuality(image(64, 64, checker), big)).toMatchObject({ ok: true, issues: [] });
  });

  it("names each problem", () => {
    expect(checkQuality(image(64, 64, checker), { width: 400, height: 300 }).issues).toContain("too_small");
    expect(checkQuality(image(64, 64, (x, y) => checker(x, y) / 8), big).issues).toContain("too_dark");
    expect(checkQuality(image(64, 64, () => 250), big).issues).toEqual(["too_bright", "blurry"]);
    expect(checkQuality(image(64, 64, () => 128), big).issues).toEqual(["blurry"]);
  });
});

describe("checkFraming", () => {
  // A 900 × 1200 portrait with a well-placed face: room above for hair, room either side.
  const W = 900; // portrait 900 × 1200
  const good: FaceBox = { x: 300, y: 400, width: 300, height: 340, score: 0.95 };

  it("passes a centred face with space above and beside it", () => {
    expect(checkFraming([good], W)).toEqual([]);
  });

  it("asks for the shoulders when the photo stops at the chin (length needs them)", () => {
    expect(checkFraming([good], W, "front", 1200)).toEqual([]);
    expect(checkFraming([good], W, "front", 760)).toEqual(["shoulders_cut_off"]);
    expect(checkFraming([good], W, "left", 760)).toEqual([]);
  });

  it("needs exactly one confident face", () => {
    expect(checkFraming([], W)).toEqual(["no_face"]);
    expect(checkFraming([{ ...good, score: 0.3 }], W)).toEqual(["no_face"]);
    expect(checkFraming([good, { ...good, x: 20 }], W)).toEqual(["multiple_faces"]);
  });

  it("only refuses a second person on turned shots", () => {
    expect(checkFraming([], W, "left")).toEqual([]);
    expect(checkFraming([{ ...good, x: 0, y: 0 }], W, "right")).toEqual([]);
    expect(checkFraming([good, { ...good, x: 20 }], W, "right")).toEqual(["multiple_faces"]);
    expect(checkFraming([good, { ...good, x: 20, score: 0.2 }], W)).toEqual([]);
  });

  it("flags a face that's too small to read hair", () => {
    expect(checkFraming([{ ...good, width: 120, height: 140, x: 390 }], W)).toContain("too_far");
  });

  it("flags a head cut off at the top", () => {
    expect(checkFraming([{ ...good, y: 100 }], W)).toEqual(["head_cut_off"]);
  });

  it("flags hair cut off at the sides", () => {
    expect(checkFraming([{ ...good, x: 20 }], W)).toEqual(["sides_cut_off"]);
    expect(checkFraming([{ ...good, x: W - good.width - 10 }], W)).toEqual(["sides_cut_off"]);
  });
});
