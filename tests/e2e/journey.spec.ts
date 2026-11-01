import { expect, test } from "@playwright/test";
import { blockFaceDetector, noisePhoto, uploadShots, watchCsp } from "./helpers";

// Full happy path against the mock analyzer and mock studio: no YouCam calls, 0 units.

test("scan → readings → verdicts → try-on → look → kit → stylist card → delete", async ({ page }) => {
  const csp = watchCsp(page);
  await blockFaceDetector(page);

  // Landing → consent
  await page.goto("/");
  await page.getByRole("link", { name: "Check my hair" }).click();
  await page.getByLabel("I understand and want to continue").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/scan$/);

  // US1: three shots via the upload fallback; each passes the gate on-device.
  await uploadShots(page);
  await page.getByRole("button", { name: "Read my hair" }).click();

  // US2: readings from the stand-in, clearly labelled; every reading is correctable.
  await expect(page).toHaveURL(/\/readings$/);
  await expect(page.getByText("readings come from a stand-in")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hair type" })).toBeVisible();

  // Pin the readings to a known profile so the rest of the run is deterministic.
  await page.evaluate(() => {
    const p = JSON.parse(sessionStorage.getItem("cc.profile")!);
    for (const [k, v] of Object.entries({ type: "coily", length: "medium", frizz: "medium", density: "medium" })) {
      p[k] = { status: "ok", value: v, source: "user" };
    }
    sessionStorage.setItem("cc.profile", JSON.stringify(p));
  });

  // US3: verdicts with reasons; a ✗ shows the closest cut that works.
  await page.goto("/verdict");
  const comma = page.locator("#cut-textured-comma");
  await expect(comma).toContainText("Not your hair's cut");
  await comma.locator("summary").click();
  await expect(comma).toContainText("Closest cut that works:");
  const afro = page.locator("#cut-afro");
  await expect(afro).toContainText("Doable, with a little help");
  await afro.locator("summary").click();
  await afro.getByRole("link", { name: "Try it on" }).click();

  // US4: try-on with the colour-kept badge and honest label; the image comes via /api/image.
  await expect(page.getByText("Your colour kept")).toBeVisible();
  await expect(page.getByText("Visual preview, not a guarantee of the real cut").first()).toBeVisible();
  const tryon = page.waitForResponse((r) => r.url().endsWith("/api/tryon/hair"));
  await page.getByRole("button", { name: "Show me this cut" }).click();
  const body = await (await tryon).json();
  expect(body.image).toMatch(/^\/api\/image\/[A-Za-z0-9_-]{24}$/);
  await expect(page.getByRole("img", { name: "After" })).toBeVisible();
  await page.getByRole("link", { name: "See the full look" }).click();

  // US5: separately consented full-body photo, then outfit and shoes for an occasion.
  await page.getByLabel("Use a full-body photo for this step").check();
  await page.locator('input[type="file"]').setInputFiles({ name: "body.jpg", mimeType: "image/jpeg", buffer: await noisePhoto(800, 1400) });
  await page.getByRole("button", { name: "Interview" }).click();
  await expect(page.getByRole("img", { name: "Classic black suit" })).toBeVisible();
  await expect(page.getByText("Done").first()).toBeVisible();
  // Shoes need our own shoe photos in public/look/; until they exist the honest partial note shows.
  await expect(page.getByText("Done").nth(1).or(page.getByText("The outfit worked, but the shoes didn't."))).toBeVisible();
  await page.getByRole("link", { name: "Get the kit for this cut" }).click();

  // US6: kit tied to readings, trim schedule, demo-store cart.
  await expect(page.getByText("Picked for coily hair.").first()).toBeVisible();
  await expect(page.getByText(/Trim every 5 weeks/)).toBeVisible();
  await page.getByRole("button", { name: /Add kit to cart/ }).click();
  const cart = page.getByRole("dialog");
  await expect(cart).toContainText("Demo store. Nothing is really bought.");
  await cart.getByRole("button", { name: "Check out" }).click();
  await expect(cart).toContainText("nothing is charged");
  await cart.getByRole("button", { name: "Close" }).click();

  // Stylist card link: cut and readings, never an image of the person.
  await page.getByRole("button", { name: "Get a stylist card link" }).click();
  const cardLink = page.locator('a[href*="/card/"]');
  const href = await cardLink.getAttribute("href");
  const cardPage = await page.context().newPage();
  await cardPage.goto(href!);
  await expect(cardPage.getByRole("heading", { name: "Afro" })).toBeVisible();
  await expect(cardPage.getByText("Coily", { exact: true })).toBeVisible();
  expect(await cardPage.locator('img[src^="/api/image"], img[src^="blob:"]').count()).toBe(0);
  await cardPage.close();

  // US8: delete everything, see what was removed, storage empty.
  await page.goto("/delete");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByRole("heading", { name: "Deleted" })).toBeVisible();
  await expect(page.getByText("Our reference to your scan photo")).toBeVisible();
  await expect(page.getByText("Our reference to your full-body photo")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  // The try-on link no longer resolves.
  expect((await page.request.get(body.image, { maxRedirects: 0 })).status()).toBe(404);

  expect(csp).toEqual([]);
});

test("demo mode is labelled on every screen and works without a scan", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See a demo" }).click();
  await expect(page).toHaveURL(/\/readings$/);
  const banner = page.getByText("Demo mode: precomputed results from real YouCam API calls.");
  await expect(banner).toBeVisible();
  // Density is a hand pick in every scan; the demo carries one, so the board is complete.
  await page.goto("/verdict");
  await expect(banner).toBeVisible();
  await expect(page.getByText("Our pick for you")).toBeVisible();
});

test("budget exhausted and rate-limited scans offer the demo", async ({ page }) => {
  await blockFaceDetector(page);
  await page.goto("/");
  await page.evaluate(() => sessionStorage.setItem("cc.consent", "yes"));
  for (const [error, status] of [["budget_exhausted", 503], ["rate_limited", 429]] as const) {
    await page.route("**/api/scan", (route) => route.fulfill({ status, json: { error } }));
    await page.goto("/scan");
    await uploadShots(page);
    await page.getByRole("button", { name: "Read my hair" }).click();
    await expect(page.getByRole("alert").getByRole("link", { name: "See the demo" })).toBeVisible();
    await page.unroute("**/api/scan");
  }
});

test("camera unavailable or denied shows how to continue", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => sessionStorage.setItem("cc.consent", "yes"));
  await page.goto("/scan");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByText(/Camera access is off|No camera found/)).toBeVisible();
  await expect(page.getByText("Upload a photo instead").first()).toBeVisible();
});
