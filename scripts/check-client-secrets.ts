// Fails if a secret-looking env var can reach browser code.
//  1. No NEXT_PUBLIC_* name may contain KEY|SECRET|TOKEN, except the Turnstile site key.
//  2. A "use client" file may not read any env var containing KEY|SECRET|TOKEN.
//  3. Any other src file that reads such a var must import "server-only".
//  4. A "use client" file may not import the session module (which can't use "server-only").
// Usage: npm run check:secrets
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const ALLOWED_PUBLIC = new Set(["NEXT_PUBLIC_TURNSTILE_SITE_KEY"]);
const SECRETISH = /(KEY|SECRET|TOKEN)/;
// Server modules that can't import "server-only" because src/proxy.ts (not a React Server
// environment) uses them. Rule 4 below stops client code importing them instead.
const SERVER_ENTRYPOINTS = new Set(["src/proxy.ts", "src/lib/security/session.ts"]);

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(e.name) ? [full] : [];
  });
}

const problems: string[] = [];

for (const file of walk(path.join(root, "src"))) {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  const src = fs.readFileSync(file, "utf8");
  const isClient = /^\s*["']use client["']/m.test(src.slice(0, 200));

  if (isClient && /from\s+["'][^"']*security\/session["']/.test(src)) {
    problems.push(`${rel}: client component imports the session module`);
  }

  for (const m of src.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
    if (SECRETISH.test(m[0]) && !ALLOWED_PUBLIC.has(m[0])) {
      problems.push(`${rel}: public env var "${m[0]}" looks like a secret`);
    }
  }

  const secretReads = [...src.matchAll(/process\.env(?:\.([A-Z0-9_]+)|\[["']([A-Z0-9_]+)["']\])/g)]
    .map((m) => m[1] ?? m[2])
    .filter((name) => SECRETISH.test(name) && !ALLOWED_PUBLIC.has(name));
  if (secretReads.length === 0) continue;

  if (isClient) {
    problems.push(`${rel}: client component reads ${secretReads.join(", ")}`);
  } else if (!SERVER_ENTRYPOINTS.has(rel) && !/import\s+["']server-only["']/.test(src)) {
    problems.push(`${rel}: reads ${secretReads.join(", ")} but does not import "server-only"`);
  }
}

if (problems.length) {
  console.error("Secret check failed:\n" + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log("Secret check: clean");
