// Fails if user-facing text contains a banned claim.
// Usage: npm run claims
import fs from "node:fs";
import path from "node:path";
import {
  extractCopyStrings,
  extractJsonStrings,
  extractJsxUserText,
  extractPlainText,
  lintChunks,
  type ClaimHit,
} from "../src/lib/claims/lint";

const root = path.resolve(__dirname, "..");

function walk(dir: string, filter: (f: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, filter);
    return filter(full) ? [full] : [];
  });
}

const rel = (f: string) => path.relative(root, f).replaceAll("\\", "/");
const read = (f: string) => fs.readFileSync(f, "utf8");
const hits: ClaimHit[] = [];

for (const f of walk(path.join(root, "src"), (f) => f.endsWith(".tsx"))) {
  hits.push(...lintChunks(rel(f), extractJsxUserText(read(f), f)));
}
for (const f of walk(path.join(root, "src", "copy"), (f) => f.endsWith(".ts"))) {
  hits.push(...lintChunks(rel(f), extractCopyStrings(read(f), f)));
}
for (const f of walk(path.join(root, "data"), (f) => f.endsWith(".json"))) {
  hits.push(...lintChunks(rel(f), extractJsonStrings(read(f))));
}
for (const name of ["README.md", "docs/WRITEUP.md"]) {
  const f = path.join(root, name);
  if (fs.existsSync(f)) hits.push(...lintChunks(name, extractPlainText(read(f))));
}

if (hits.length) {
  console.error(`Claims linter: ${hits.length} banned term(s) in user-facing text\n`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  [${h.term}]  ${h.text}`);
  console.error("\nRephrase it or, if the phrase is honest, add it to ALLOWED_PHRASES.");
  process.exit(1);
}
console.log("Claims linter: clean");
