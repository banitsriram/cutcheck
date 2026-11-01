"use client";

import { detectFaces } from "./face-detector";
import type { Shot } from "../hair/types";
import { checkFraming, checkQuality, framingMetrics, GATE, type GateResult } from "./quality-gate";

// Browser-side photo preparation: honour EXIF orientation, run the
// quality gate on a small copy, and downscale to ≤ 1600 px JPEG before upload so all three
// shots stay far below Vercel's 4.5 MB body limit.

/** Three shots go in one request; YouCam downsizes past 1080 px anyway. */
/** Curl pattern and frizz live in fine detail, so hair photos keep more of it than a face check would need. */
export const UPLOAD_MAX_SIDE = 1600;
const SAMPLE_WIDTH = 256;
const JPEG_QUALITY = 0.85;

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas unavailable");
  return { c, ctx };
}

export interface PreparedPhoto {
  gate: GateResult;
  /** Downscaled JPEG; only present when the gate passed. */
  upload?: Blob;
}

export async function preparePhoto(source: Blob, shot: Shot = "front"): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const { width, height } = bitmap;

    const sw = Math.min(SAMPLE_WIDTH, width);
    const sh = Math.max(1, Math.round((height / width) * sw));
    const sample = canvas(sw, sh);
    sample.ctx.drawImage(bitmap, 0, 0, sw, sh);
    const pixels = checkQuality(sample.ctx.getImageData(0, 0, sw, sh), { width, height });
    // Framing runs even when pixels fail, so the person gets every retake hint at once.
    const faces = await detectFaces(bitmap);
    const framing = faces ? checkFraming(faces, width, shot, height) : [];
    const issues = [...pixels.issues, ...framing];
    const gate: GateResult = {
      ...pixels,
      ok: issues.length === 0,
      issues,
      faceCheck: faces !== null,
      framing: faces ? framingMetrics(faces, width) : null,
    };
    if (!gate.ok) return { gate };

    const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(width, height));
    const out = canvas(Math.round(width * scale), Math.round(height * scale));
    out.ctx.drawImage(bitmap, 0, 0, out.c.width, out.c.height);
    const upload = await new Promise<Blob>((resolve, reject) =>
      out.c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", JPEG_QUALITY),
    );
    return { gate, upload };
  } finally {
    bitmap.close();
  }
}

/** Grabs the current video frame as a JPEG (un-mirrored, full camera resolution). */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const { c, ctx } = canvas(video.videoWidth, video.videoHeight);
  ctx.drawImage(video, 0, 0);
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("capture failed"))), "image/jpeg", 0.92),
  );
}

export type BodyIssue = "not_portrait" | "multiple_faces" | "too_small" | "too_dark" | "too_bright" | "blurry";

/** Longer side for the full-body photo: the outfit needs more pixels than a head shot. */
export const BODY_MAX_SIDE = 1600;

/**
 * Gate for the Look step's full-body photo. The face model can't see feet,
 * so "whole body in frame" is approximated by an upright frame; YouCam rejects the rest at no cost.
 */
export async function prepareBodyPhoto(source: Blob): Promise<{ issues: BodyIssue[]; upload?: Blob }> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const { width, height } = bitmap;
    const sw = Math.min(SAMPLE_WIDTH, width);
    const sh = Math.max(1, Math.round((height / width) * sw));
    const sample = canvas(sw, sh);
    sample.ctx.drawImage(bitmap, 0, 0, sw, sh);
    const pixels = checkQuality(sample.ctx.getImageData(0, 0, sw, sh), { width, height });
    const faces = await detectFaces(bitmap);
    const issues: BodyIssue[] = [];
    if (height < width * 1.2) issues.push("not_portrait");
    if (faces && faces.filter((f) => f.score >= GATE.minFaceScore).length > 1) issues.push("multiple_faces");
    for (const i of pixels.issues) {
      if (i === "too_small" || i === "too_dark" || i === "too_bright" || i === "blurry") issues.push(i);
    }
    if (issues.length > 0) return { issues };

    const scale = Math.min(1, BODY_MAX_SIDE / Math.max(width, height));
    const out = canvas(Math.round(width * scale), Math.round(height * scale));
    out.ctx.drawImage(bitmap, 0, 0, out.c.width, out.c.height);
    const upload = await new Promise<Blob>((resolve, reject) =>
      out.c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", JPEG_QUALITY),
    );
    return { issues, upload };
  } finally {
    bitmap.close();
  }
}
