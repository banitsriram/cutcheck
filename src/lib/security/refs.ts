import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { ResultImage } from "../studio/studio";
import type { CounterStore } from "./store";

// Short-lived references to a session's images. These point at a face, so they are
// personal data: short TTLs, never logged, all removed by /api/delete.

export const FILE_REF_TTL = 30 * 60; // seconds
/** Result-image tokens: 15 minutes, bound to the session that created them. */
export const IMAGE_TOKEN_TTL = 15 * 60;

const fileKey = (sessionId: string) => `file:${sessionId}`;
const bodyFileKey = (sessionId: string) => `bodyfile:${sessionId}`;
const tasksKey = (sessionId: string) => `tasks:${sessionId}`;
const imagesKey = (sessionId: string) => `imgs:${sessionId}`;
const lookClothesKey = (sessionId: string) => `lookclothes:${sessionId}`;
const imageKey = (token: string) => `img:${token}`;
const MAX_TASK_IDS = 64;
const MAX_IMAGE_TOKENS = 32;

const storedImageSchema = z.object({
  sid: z.string(),
  image: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("remote"), url: z.url() }),
    z.object({ kind: z.literal("local"), path: z.string().startsWith("/") }),
  ]),
});

export async function saveFileRef(store: CounterStore, sessionId: string, fileRef: string): Promise<void> {
  await store.set(fileKey(sessionId), fileRef, FILE_REF_TTL);
}

export async function getFileRef(store: CounterStore, sessionId: string): Promise<string | null> {
  return store.get(fileKey(sessionId));
}

/** Remembers vendor task ids so /api/delete can ask YouCam to remove them. */
export async function addTaskIds(store: CounterStore, sessionId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const existing = (await store.get(tasksKey(sessionId)))?.split(",").filter(Boolean) ?? [];
  const merged = [...new Set([...existing, ...ids])].slice(-MAX_TASK_IDS);
  await store.set(tasksKey(sessionId), merged.join(","), FILE_REF_TTL);
}

export async function getTaskIds(store: CounterStore, sessionId: string): Promise<string[]> {
  return (await store.get(tasksKey(sessionId)))?.split(",").filter(Boolean) ?? [];
}

export async function saveBodyFileRef(store: CounterStore, sessionId: string, fileRef: string): Promise<void> {
  await store.set(bodyFileKey(sessionId), fileRef, FILE_REF_TTL);
  // A new body photo invalidates the previous outfit result.
  await store.del(lookClothesKey(sessionId));
}

export async function getBodyFileRef(store: CounterStore, sessionId: string): Promise<string | null> {
  return store.get(bodyFileKey(sessionId));
}

/** The clothes result, kept server-side so the shoes step can start from it. */
export async function saveLookClothes(store: CounterStore, sessionId: string, image: ResultImage): Promise<void> {
  await store.set(lookClothesKey(sessionId), JSON.stringify(image), FILE_REF_TTL);
}

export async function getLookClothes(store: CounterStore, sessionId: string): Promise<ResultImage | null> {
  const raw = await store.get(lookClothesKey(sessionId));
  if (!raw) return null;
  try {
    return storedImageSchema.shape.image.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Issues a random token for a result image; the browser only ever sees /api/image/<token>. */
export async function saveImageRef(store: CounterStore, sessionId: string, image: ResultImage): Promise<string> {
  const token = randomBytes(18).toString("base64url");
  await store.set(imageKey(token), JSON.stringify({ sid: sessionId, image }), IMAGE_TOKEN_TTL);
  const existing = (await store.get(imagesKey(sessionId)))?.split(",").filter(Boolean) ?? [];
  await store.set(imagesKey(sessionId), [...existing, token].slice(-MAX_IMAGE_TOKENS).join(","), FILE_REF_TTL);
  return token;
}

/** The image behind a token, or null if it expired or belongs to another session. */
export async function getImageRef(store: CounterStore, sessionId: string, token: string): Promise<ResultImage | null> {
  if (!/^[A-Za-z0-9_-]{24}$/.test(token)) return null;
  const raw = await store.get(imageKey(token));
  if (!raw) return null;
  try {
    const stored = storedImageSchema.parse(JSON.parse(raw));
    return stored.sid === sessionId ? stored.image : null;
  } catch {
    return null;
  }
}

export interface DeletedRefs {
  photo: boolean;
  bodyPhoto: boolean;
  resultImages: number;
}

/** Removes every image reference held for the session and says what was there. */
export async function deleteSessionRefs(store: CounterStore, sessionId: string): Promise<DeletedRefs> {
  const [photo, body, images] = await Promise.all([
    store.get(fileKey(sessionId)),
    store.get(bodyFileKey(sessionId)),
    store.get(imagesKey(sessionId)),
  ]);
  const tokens = images?.split(",").filter(Boolean) ?? [];
  await store.del(
    fileKey(sessionId),
    bodyFileKey(sessionId),
    tasksKey(sessionId),
    imagesKey(sessionId),
    lookClothesKey(sessionId),
    ...tokens.map(imageKey),
  );
  return { photo: photo !== null, bodyPhoto: body !== null, resultImages: tokens.length };
}
