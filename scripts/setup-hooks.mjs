// Points git at .githooks so the gitleaks pre-commit hook runs. No-op outside a git checkout (Vercel, CI).
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.env.CI || process.env.VERCEL || !existsSync(".git")) process.exit(0);
try {
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
} catch {
  // git missing: nothing to configure
}
