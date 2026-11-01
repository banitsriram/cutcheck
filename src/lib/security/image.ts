import "server-only";
import sharp from "sharp";

// Image sanitiser. Everything happens in memory; nothing is written anywhere.
// Only the re-encoded buffer returned here may be sent to YouCam.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel rejects bodies > 4.5 MB
export const MAX_INPUT_SIDE = 4096;
export const OUTPUT_LONGEST_SIDE = 1600;

export type ImageKind = "jpeg" | "png" | "webp";

export type SanitiseResult =
  | { ok: true; buffer: Buffer; width: number; height: number }
  | { ok: false; reason: "too_large" | "unsupported_type" | "too_many_pixels" | "unreadable" };

/** Identifies the format from magic bytes only, never the file name or the declared MIME type. */
export function sniffImageType(bytes: Uint8Array): ImageKind | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return "jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

export async function sanitiseImage(input: Buffer, longestSide = OUTPUT_LONGEST_SIDE): Promise<SanitiseResult> {
  if (input.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  if (!sniffImageType(input)) return { ok: false, reason: "unsupported_type" };

  try {
    // limitInputPixels guards against decompression bombs before any pixels are decoded.
    const meta = await sharp(input, { limitInputPixels: MAX_INPUT_SIDE * MAX_INPUT_SIDE }).metadata();
    if (!meta.width || !meta.height) return { ok: false, reason: "unreadable" };
    if (meta.width > MAX_INPUT_SIDE || meta.height > MAX_INPUT_SIDE) return { ok: false, reason: "too_many_pixels" };

    // sharp drops all metadata (EXIF, GPS, ICC, XMP) unless asked to keep it; rotate() applies the
    // EXIF orientation first so the stripped image still looks right.
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_SIDE * MAX_INPUT_SIDE })
      .rotate()
      .resize({ width: longestSide, height: longestSide, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { ok: true, buffer: data, width: info.width, height: info.height };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}
