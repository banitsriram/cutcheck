"use client";

import type { FaceDetector } from "@mediapipe/tasks-vision";
import { GATE, type FaceBox } from "./quality-gate";

// MediaPipe BlazeFace (short range) for the capture gate. Runs entirely in the browser;
// the WASM runtime and model are self-hosted under /mediapipe (no CDN, CSP stays 'self').
// Loaded lazily on the first photo check, then reused.

const WASM_BASE = "/mediapipe/wasm";
const MODEL_URL = "/mediapipe/blaze_face_short_range.tflite";

let loading: Promise<FaceDetector | null> | null = null;

function load(): Promise<FaceDetector | null> {
  loading ??= (async () => {
    try {
      const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      return await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: GATE.minFaceScore,
      });
    } catch {
      // Unsupported browser or blocked download: the gate falls back to pixel checks only,
      // and the hair readings' own confidence/inconclusive states still apply.
      loading = null;
      return null;
    }
  })();
  return loading;
}

/** Faces in the image, or null when the detector couldn't load. */
export async function detectFaces(image: ImageBitmap): Promise<FaceBox[] | null> {
  const detector = await load();
  if (!detector) return null;
  return detector.detect(image).detections.flatMap((d) =>
    d.boundingBox
      ? [
          {
            x: d.boundingBox.originX,
            y: d.boundingBox.originY,
            width: d.boundingBox.width,
            height: d.boundingBox.height,
            score: d.categories[0]?.score ?? 0,
          },
        ]
      : [],
  );
}
