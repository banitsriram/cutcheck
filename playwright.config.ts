import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// E2E against a dev server of its own: separate build folder, YouCam key blanked so the
// labelled mock analyzer and mock studio run, no network calls to YouCam, no units spent.

const PORT = 3199;
// Generated per run so no judge code ever sits in the repo.
process.env.E2E_JUDGE_CODE ??= randomBytes(24).toString("hex");
const judgeCode = process.env.E2E_JUDGE_CODE;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      // Three locks against spending units: force the mocks, blank the key, and point any
      // stray call at a host that can't resolve.
      CUTCHECK_FORCE_MOCK: "true",
      YOUCAM_API_KEY: "",
      YOUCAM_BASE_URL: "https://youcam.invalid",
      YOUCAM_DISABLED: "false",
      TURNSTILE_SECRET: "",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      JUDGE_CODE: judgeCode,
    },
  },
});
