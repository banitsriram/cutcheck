import "server-only";
import type { HairAnalysis, HairAnalyzer, ScanShots } from "../analysis/analyzer";
import { readFrizz, readHairLength, readHairType } from "./mappers";
import { fileCreateSchema, imageResultSchema, PHOTO_ERRORS, taskCreateSchema, taskStatusSchema, type TaskStatus } from "./types";

// YouCam client, written against observed responses (docs/API_NOTES.md).
// The only place that reads YOUCAM_API_KEY. Never logs or returns vendor URLs, ids or images.

const REQUEST_TIMEOUT_MS = 10_000;
/** Per-task deadline: frizz took 17–33 s when probed. */
export const TASK_DEADLINE_MS = 50_000;
const POLL_BACKOFF_MS = [1000, 2000, 4000];

/** Units charged per successful task (observed; failed tasks cost 0). */
export const TASK_UNITS = { type: 2, length: 2, frizz: 2, density: 1, hairTransfer: 2, clothes: 2, shoes: 2 } as const;

export class YouCamError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`youcam ${status} ${code}`);
  }
}

function config() {
  const key = process.env.YOUCAM_API_KEY ?? "";
  const base = (process.env.YOUCAM_BASE_URL ?? "").replace(/\/$/, "");
  if (!key || !base.startsWith("https://")) throw new YouCamError(0, "not_configured");
  return { key, base };
}

export const youcamConfigured = () => Boolean(process.env.YOUCAM_API_KEY && process.env.YOUCAM_BASE_URL);

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

const jitter = (ms: number) => ms * (0.75 + Math.random() * 0.5);

/**
 * One JSON call. Retries (max 2, jittered) on network errors, 429 and 5xx when `retry` is
 * "transient"; only on 429 when "rate-limit" (task creation: a 5xx may already have created and
 * later charged a task). Never retries other 4xx; those burn nothing but would repeat forever.
 */
async function call(
  method: "GET" | "POST",
  route: string,
  body: unknown,
  signal: AbortSignal | undefined,
  retry: "transient" | "rate-limit",
): Promise<unknown> {
  const { key, base } = config();
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(base + route, {
        method,
        headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (e) {
      if (signal?.aborted || retry !== "transient" || attempt >= 2) throw e;
      await sleep(jitter(500 * 2 ** attempt), signal);
      continue;
    }
    const retryable = res.status === 429 || (retry === "transient" && res.status >= 500);
    if (retryable && attempt < 2) {
      await sleep(jitter(500 * 2 ** attempt), signal);
      continue;
    }
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const code = (json as { error_code?: unknown } | null)?.error_code;
      throw new YouCamError(res.status, typeof code === "string" ? code : "http_error");
    }
    return json;
  }
}

/** Creates a file slot and PUTs the JPEG to the signed URL. Returns the file id. */
export async function uploadFile(image: Buffer, signal?: AbortSignal): Promise<string> {
  const created = fileCreateSchema.parse(
    await call(
      "POST",
      "/s2s/v2.0/file",
      { files: [{ content_type: "image/jpeg", file_name: "photo.jpg", file_size: image.length }] },
      signal,
      "transient",
    ),
  );
  const file = created.data.files[0];
  const req = file.requests[0];
  const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)]));
  const put = await fetch(req.url, {
    method: req.method,
    headers,
    body: new Uint8Array(image),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!put.ok) throw new YouCamError(put.status, "upload_failed");
  return file.file_id;
}

/** Starts a task; returns its id. */
export async function createTask(route: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
  return taskCreateSchema.parse(await call("POST", route, body, signal, "rate-limit")).data.task_id;
}

/** Polls until success/error, or returns null at the deadline (task still running). */
export async function pollTask(route: string, taskId: string, deadline: number, signal?: AbortSignal): Promise<TaskStatus | null> {
  for (let i = 0; ; i++) {
    const wait = POLL_BACKOFF_MS[Math.min(i, POLL_BACKOFF_MS.length - 1)];
    if (Date.now() + wait > deadline) return null;
    await sleep(wait, signal);
    const status = taskStatusSchema.parse(await call("GET", `${route}/${taskId}`, undefined, signal, "transient")).data;
    if (status.task_status !== "running") return status;
  }
}

/** Deletes a finished task and its files. Running tasks can't be deleted (observed 400). */
export async function deleteTask(taskId: string, signal?: AbortSignal): Promise<boolean> {
  try {
    await call("POST", "/s2s/v2.0/task/delete", { task_id: taskId }, signal, "transient");
    return true;
  } catch {
    return false;
  }
}

const ROUTES = {
  type: "/s2s/v2.0/task/hair-type-detection",
  length: "/s2s/v2.0/task/hair-length-detection",
  frizz: "/s2s/v2.0/task/hair-frizziness-detection",
} as const;

type ReadingTask = keyof typeof ROUTES;

/** Vendor error codes only, never image data or ids. */
function logReadingFailure(reading: ReadingTask, why: string): void {
  console.warn(JSON.stringify({ t: "cutcheck", route: "scan", reading, failed: why.slice(0, 80) }));
}

/** Runs one reading task to completion; null status = failed to start, failed, or timed out. */
async function runReading(
  name: ReadingTask,
  body: Record<string, unknown>,
  deadline: number,
  signal?: AbortSignal,
): Promise<{ taskId: string | null; status: TaskStatus | null }> {
  let taskId: string | null = null;
  try {
    taskId = await createTask(ROUTES[name], body, signal);
    const status = await pollTask(ROUTES[name], taskId, deadline, signal);
    if (status?.task_status === "error") logReadingFailure(name, `task ${status.error ?? "unknown"}`);
    if (!status) logReadingFailure(name, "deadline");
    return { taskId, status };
  } catch (e) {
    logReadingFailure(name, e instanceof YouCamError ? e.message : e instanceof Error ? e.name : "unknown");
    return { taskId, status: null };
  }
}

export const youcamAnalyzer: HairAnalyzer = {
  source: "youcam",
  scanUnitsEstimate: TASK_UNITS.type + TASK_UNITS.length + TASK_UNITS.frizz,
  uploadUnitsEstimate: 0,

  async upload(front, signal) {
    return { fileRef: await uploadFile(front, signal), unitsCharged: 0 };
  },

  async analyze(shots: ScanShots, signal?: AbortSignal): Promise<HairAnalysis> {
    // Upload all three in parallel; if any upload fails the scan fails (nothing charged yet).
    const [front, left, right] = await Promise.all(
      [shots.front, shots.left, shots.right].map((img) => uploadFile(img, signal)),
    );
    const deadline = Date.now() + TASK_DEADLINE_MS;
    // Observed order for the three-view APIs: front, right, left.
    const threeViews = { src_file_ids: [front, right, left] };
    // Density isn't read: the API rejected every head-down angle we tried (API_NOTES).
    const first = await Promise.all([
      runReading("type", threeViews, deadline, signal),
      runReading("frizz", threeViews, deadline, signal),
      runReading("length", { src_file_id: front }, deadline, signal),
    ]);
    let [type, frizz] = first;
    const length = first[2];
    // Front-camera photos are often mirrored (iOS saves selfies flipped), so "left" reaches YouCam
    // as "right" and it answers error_face_angle_invalid at no charge. Retry once with the sides swapped.
    const failedTaskIds: string[] = [];
    const angleRejected = (r: typeof type) => r.status?.task_status === "error" && r.status.error === "error_face_angle_invalid";
    const swapped = { src_file_ids: [front, left, right] };
    const retry = (name: "type" | "frizz", r: typeof type) => {
      if (!angleRejected(r)) return r;
      if (r.taskId) failedTaskIds.push(r.taskId);
      return runReading(name, swapped, deadline, signal);
    };
    [type, frizz] = await Promise.all([retry("type", type), retry("frizz", frizz)]);

    // Settle conservatively: a task still running at the deadline may yet succeed and be charged.
    const succeeded = (r: { taskId: string | null; status: TaskStatus | null }) =>
      r.status?.task_status === "success" || (r.taskId !== null && r.status === null);
    const unitsCharged =
      (succeeded(type) ? TASK_UNITS.type : 0) +
      (succeeded(frizz) ? TASK_UNITS.frizz : 0) +
      (succeeded(length) ? TASK_UNITS.length : 0);

    return {
      readings: {
        type: readHairType(type.status),
        length: readHairLength(length.status),
        frizz: readFrizz(frizz.status),
        density: { status: "inconclusive", reason: "manual" },
      },
      fileRef: front,
      taskIds: [...failedTaskIds, ...[type, frizz, length].flatMap((r) => (r.taskId ? [r.taskId] : []))],
      unitsCharged,
    };
  },
};

// ---------- image tasks: hair try-on, clothes, shoes ----------

const IMAGE_ROUTES = {
  hairTransfer: "/s2s/v2.1/task/hair-transfer",
  clothes: "/s2s/v2.0/task/cloth",
  shoes: "/s2s/v2.0/task/shoes-transfer",
} as const;

export type ImageTask = keyof typeof IMAGE_ROUTES;

export interface ImageTaskResult {
  /** Signed vendor URL of the result (about 2 h). Server-side only: never sent to the browser. */
  url: string | null;
  taskId: string | null;
  unitsCharged: number;
  /** Why there's no image: the photo was rejected, or the service failed or timed out. */
  failure?: "photo" | "service";
}

/** One image task, created and polled to the shared deadline. Never more than one per route. */
export async function runImageTask(
  task: ImageTask,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ImageTaskResult> {
  let taskId: string | null = null;
  try {
    taskId = await createTask(IMAGE_ROUTES[task], body, signal);
    const status = await pollTask(IMAGE_ROUTES[task], taskId, Date.now() + TASK_DEADLINE_MS, signal);
    // Still running at the deadline: it may yet succeed and be charged, so settle as charged.
    if (!status) return { url: null, taskId, unitsCharged: TASK_UNITS[task], failure: "service" };
    if (status.task_status === "error") {
      return { url: null, taskId, unitsCharged: 0, failure: PHOTO_ERRORS.has(status.error ?? "") ? "photo" : "service" };
    }
    const parsed = imageResultSchema.safeParse(status.results);
    return parsed.success
      ? { url: parsed.data.url, taskId, unitsCharged: TASK_UNITS[task] }
      : { url: null, taskId, unitsCharged: TASK_UNITS[task], failure: "service" };
  } catch {
    // A failed create costs nothing; once a task exists it may still be charged.
    return { url: null, taskId, unitsCharged: taskId ? TASK_UNITS[task] : 0, failure: "service" };
  }
}
