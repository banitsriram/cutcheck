import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Copies the shoe reference photos from fixtures/private/look/ (gitignored) into public/look/
// as the Look step's shoe references: EXIF/GPS stripped, re-encoded, at most 900 px.
// Usage: npx tsx scripts/prepare-look.ts

const SRC = path.join(__dirname, "..", "fixtures", "private", "look");
const OUT = path.join(__dirname, "..", "public", "look");
const NAMES = ["shoes-everyday", "shoes-interview", "shoes-nightout"];

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const name of NAMES) {
    const input = [".jpg", ".jpeg", ".png", ".webp"].map((ext) => path.join(SRC, name + ext)).find(existsSync);
    if (!input) {
      console.log(`missing ${name}, skipped`);
      continue;
    }
    // sharp drops all metadata unless asked to keep it; rotate() applies EXIF orientation first.
    const out = await sharp(input).rotate().resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    writeFileSync(path.join(OUT, `${name}.jpg`), out);
    console.log(`wrote public/look/${name}.jpg (${Math.round(out.length / 1024)} KB, metadata stripped)`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
