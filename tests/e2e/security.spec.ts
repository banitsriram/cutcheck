import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { noisePhoto, watchCsp } from "./helpers";

// Security and accessibility checks for the deployed app.

const PAGES = ["/", "/consent", "/scan", "/readings", "/verdict", "/how-we-decide", "/privacy", "/tryon?cut=afro", "/look?cut=afro", "/kit?cut=afro", "/delete", "/for-salons"];

test("every page sends a nonce CSP and the hardening headers, with no CSP violations", async ({ page }) => {
  const violations = watchCsp(page);
  for (const path of PAGES) {
    const res = await page.goto(path);
    const h = res!.headers();
    expect(h["content-security-policy"], path).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["permissions-policy"]).toContain("camera=(self)");
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});

test("the client bundle carries no YouCam key or vendor host", async ({ page }) => {
  const scripts: string[] = [];
  page.on("response", async (r) => {
    if (r.request().resourceType() === "script") scripts.push(await r.text().catch(() => ""));
  });
  for (const path of ["/", "/scan", "/tryon?cut=afro", "/look?cut=afro", "/kit?cut=afro"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  const all = scripts.join("\n");
  expect(all).not.toMatch(/YOUCAM_API_KEY|makeupar\.com|perfectcorp\.com|Bearer /);
});

test("cross-origin POSTs are refused", async ({ request, baseURL }) => {
  for (const path of ["/api/scan", "/api/tryon/hair", "/api/delete", "/api/look/clothes"]) {
    const res = await request.post(path, { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" }, data: {} });
    expect(res.status(), path).toBe(403);
  }
  expect(baseURL).toBeTruthy();
});

test("?k= sets a judge pass and redirects to a clean URL", async ({ page, context }) => {
  await page.goto(`/?k=${process.env.E2E_JUDGE_CODE}`);
  expect(new URL(page.url()).search).toBe("");
  expect((await context.cookies()).some((c) => c.name === "cc_judge" && c.httpOnly)).toBe(true);
  // A wrong code redirects the same way and sets nothing.
  await context.clearCookies();
  await page.goto("/?k=wrong-code-wrong-code");
  expect(new URL(page.url()).search).toBe("");
  expect((await context.cookies()).some((c) => c.name === "cc_judge")).toBe(false);
});

test("result images are bound to the session that created them", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();
  await pa.goto("/");
  await pb.goto("/");
  // Session A gets a reference (reupload, mock analyzer) and a try-on token.
  const form = { image: { name: "front.jpg", mimeType: "image/jpeg", buffer: await noisePhoto(640, 800) }, mode: "reupload" };
  expect((await pa.request.post("/api/scan", { multipart: form, headers: { origin: new URL(pa.url()).origin } })).status()).toBe(200);
  const tryon = await pa.request.post("/api/tryon/hair", { data: { cutId: "buzz-cut" }, headers: { origin: new URL(pa.url()).origin } });
  const { image } = await tryon.json();
  expect((await pa.request.get(image, { maxRedirects: 0 })).status()).toBe(302);
  expect((await pb.request.get(image, { maxRedirects: 0 })).status()).toBe(404);
  await a.close();
  await b.close();
});

test("an oversized upload gets our friendly error, not a platform error page", async ({ page }) => {
  await page.goto("/");
  // Just over our 4.4 MB cap (Vercel's own limit is 4.5 MB, so ours must answer first).
  const big = Buffer.alloc(4_450_000, 0xff);
  const res = await page.request.post("/api/scan", {
    headers: { origin: new URL(page.url()).origin },
    multipart: { front: { name: "front.jpg", mimeType: "image/jpeg", buffer: big } },
  });
  expect(res.status()).toBe(422);
  expect(await res.json()).toMatchObject({ error: "image_rejected" });
});

test("main screens have no serious accessibility violations", async ({ page }) => {
  // Judge the settled page: mid-fade text is partly transparent and would read as low contrast.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/readings$/);
  for (const path of ["/", "/consent", "/readings", "/verdict", "/how-we-decide", "/kit?cut=afro", "/privacy", "/delete"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path}: ${v.id} (${v.nodes.length})`)).toEqual([]);
  }
});
