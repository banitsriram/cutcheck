import { randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import sharp from "sharp";

// Synthetic photos for e2e: random noise passes the pixel checks (size, light, sharpness) and
// contains no person. The face detector is blocked in these tests, so the gate falls back to
// pixel checks (as it does on browsers that can't load MediaPipe).

export async function noisePhoto(width: number, height: number): Promise<Buffer> {
  const raw = randomBytes(width * height * 3);
  // Lift the noise into the gate's brightness range (55–205).
  for (let i = 0; i < raw.length; i++) raw[i] = 70 + (raw[i] % 110);
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

export async function blockFaceDetector(page: Page): Promise<void> {
  await page.route("**/mediapipe/**", (route) => route.abort());
}

/** Uploads the three scan shots, waiting for each on-device check before the next. */
export async function uploadShots(page: Page): Promise<void> {
  const shot = await noisePhoto(900, 1200);
  for (let i = 0; i < 3; i++) {
    await page.locator('input[type="file"]').setInputFiles({ name: `shot${i}.jpg`, mimeType: "image/jpeg", buffer: shot });
    if (i < 2) await expect(page.getByText(`Photo ${i + 2} of 3`)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Read my hair" })).toBeEnabled();
}

/** Collects CSP violations reported on the page. */
export function watchCsp(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(msg.text())) violations.push(msg.text());
  });
  return violations;
}
