// Copies MediaPipe's WASM runtime from node_modules into public/ so it is served from our own
// origin (no CDN, so the CSP stays 'self'). Runs before `dev` and `build`. The files are
// ~14 MB each and regenerated every time, so public/mediapipe/wasm/ is gitignored.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const src = path.join("node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = path.join("public", "mediapipe", "wasm");
// SIMD build for current browsers, no-SIMD fallback for older ones. The "module" variant is unused.
const FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

if (!existsSync(src)) {
  console.error(`copy-mediapipe: ${src} not found. Run npm install`);
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
for (const f of FILES) copyFileSync(path.join(src, f), path.join(dest, f));
console.log(`copy-mediapipe: ${FILES.length} files → ${dest}`);
