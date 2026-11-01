// Verify-first probe. Calls the real YouCam API and records what comes back,
// so types and mappers are written from observed responses, not docs.
//
//   npx tsx scripts/probe-youcam.ts free                 # no units: key check, costs, template catalogue
//   npx tsx scripts/probe-youcam.ts collect              # no units: finish/delete tasks left running
//   npx tsx scripts/probe-youcam.ts paid <folder> [tpl] [--only=type,frizz,...]
//       # spends units. <folder> holds front/left/right/down photos (fixtures/private, gitignored).
//
// Reads YOUCAM_API_KEY / YOUCAM_BASE_URL from .env.local. Never prints the key, vendor URLs,
// file/task ids or images. Redacted samples go to docs/api-samples/ (committed); anything
// account-specific goes to docs/api-samples/raw/ (gitignored).

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(__dirname, "..");
process.loadEnvFile(path.join(root, ".env.local"));

const KEY = process.env.YOUCAM_API_KEY ?? "";
const BASE = (process.env.YOUCAM_BASE_URL ?? "").replace(/\/$/, "");
if (!KEY || !BASE.startsWith("https://")) {
  console.error("Set YOUCAM_API_KEY and an https YOUCAM_BASE_URL in .env.local");
  process.exit(1);
}

const SAMPLES = path.join(root, "docs/api-samples");
const RAW = path.join(SAMPLES, "raw");
fs.mkdirSync(RAW, { recursive: true });

const SECRET_KEYS = /url|file_id|task_id|token|headers|^id$/i;

/** Replaces ids, URLs and tokens; keeps structure, enums and numbers. */
function redact(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((v) => redact(v, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  if (typeof value === "string" && (SECRET_KEYS.test(key) || /^https?:\/\//.test(value))) return "<redacted>";
  return value;
}

function save(name: string, data: unknown, { raw = false } = {}) {
  const file = path.join(raw ? RAW : SAMPLES, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(raw ? data : redact(data), null, 2) + "\n");
  console.log(`  saved ${path.relative(root, file)}`);
}

interface Call {
  status: number;
  ms: number;
  body: unknown;
}

async function api(method: string, route: string, body?: unknown): Promise<Call> {
  const started = Date.now();
  const res = await fetch(BASE + route, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {}
  const ms = Date.now() - started;
  const code = (parsed as { error_code?: string })?.error_code ?? "";
  console.log(`  ${method} ${route.replace(/\/[A-Za-z0-9_-]{20,}$/, "/<id>")} → ${res.status} ${code} (${ms} ms)`);
  return { status: res.status, ms, body: parsed };
}

async function credit(): Promise<number | null> {
  const r = await api("GET", "/s2s/v1.0/client/credit");
  const results = (r.body as { results?: { amount_dec?: number; amount?: number }[] })?.results;
  return results ? results.reduce((n, x) => n + (x.amount_dec ?? x.amount ?? 0), 0) : null;
}

/** Follows next_token pages (page_size max is 20). `pick` returns [items, next_token]. */
async function listAll(route: string, pick: (body: unknown) => [unknown[] | undefined, string | undefined]) {
  const all: unknown[] = [];
  let token: string | undefined;
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ page_size: "20", ...(token ? { starting_token: token } : {}) });
    const r = await api("GET", `${route}?${q}`);
    const [items, next] = pick(r.body);
    all.push(...(items ?? []));
    token = next;
    if (!token || !items?.length) break;
  }
  return all;
}

const templatesPage = (body: unknown): [unknown[] | undefined, string | undefined] => {
  const data = (body as { data?: { templates?: unknown[]; next_token?: string } })?.data;
  return [data?.templates, data?.next_token];
};

/** Template entries with the thumbnail reduced to origin + path (query strings may carry signatures). */
function catalogue(templates: unknown[]) {
  return templates.map((t) => {
    const { thumb, ...rest } = t as { thumb?: string };
    let thumbPath: string | undefined;
    try {
      if (thumb) thumbPath = new URL(thumb).pathname;
    } catch {}
    return { ...rest, thumb_path: thumbPath };
  });
}

async function free() {
  console.log("Key check + balance (free)");
  const before = await api("GET", "/s2s/v1.0/client/credit");
  if (before.status === 401) {
    console.error("Key rejected (401). Check YOUCAM_API_KEY in .env.local.");
    process.exit(1);
  }
  save("credit", before.body, { raw: true });

  console.log("Feature costs (free)");
  const skus = await listAll("/s2s/v2.0/credit/feature-cost", (body) => {
    const result = (body as { result?: { skus?: unknown[]; next_token?: string } })?.result;
    return [result?.skus, result?.next_token];
  });
  save("feature-cost", { count: skus.length, skus });

  console.log("Hair Style v2.1 template catalogue (free)");
  const v21 = await listAll("/s2s/v2.1/task/template/hair-transfer", templatesPage);
  save("hair-transfer-v2.1-templates", { count: v21.length, templates: catalogue(v21) }, { raw: true });
  // Committed sample: structure only, ids redacted.
  save("hair-transfer-v2.1-templates", { count: v21.length, sample: v21.slice(0, 3) });

  console.log("Hair Style v2.0 template catalogue (free)");
  const v20 = await listAll("/s2s/v2.0/task/template/hair-style", templatesPage);
  save("hair-style-v2.0-templates", { count: v20.length, templates: catalogue(v20) }, { raw: true });
}

// ---- paid ------------------------------------------------------------------------------

async function upload(photo: string): Promise<string> {
  // Same treatment as production (security/image.ts): EXIF stripped, ≤ 1024 px JPEG.
  // --full-size skips the resize (still re-encodes, which drops EXIF) to test size-related failures.
  let img = sharp(fs.readFileSync(photo)).rotate();
  if (!process.argv.includes("--full-size")) img = img.resize(1024, 1024, { fit: "inside" });
  const jpeg = await img.jpeg({ quality: 85 }).toBuffer();
  const r = await api("POST", "/s2s/v2.0/file", {
    files: [{ content_type: "image/jpeg", file_name: "probe.jpg", file_size: jpeg.length }],
  });
  save("file-create", r.body);
  const file = (r.body as { data?: { files?: FileEntry[] }; files?: FileEntry[] });
  const entry = (file.data?.files ?? file.files)?.[0];
  const req = entry?.requests?.[0];
  if (!entry?.file_id || !req?.url) throw new Error("file create returned no upload URL");
  const started = Date.now();
  const put = await fetch(req.url, { method: req.method ?? "PUT", headers: req.headers, body: new Uint8Array(jpeg) });
  console.log(`  upload → ${put.status} (${Date.now() - started} ms, ${jpeg.length} bytes)`);
  if (!put.ok) throw new Error("upload failed");
  return entry.file_id;
}

interface FileEntry {
  file_id?: string;
  requests?: { url?: string; method?: string; headers?: Record<string, string> }[];
}

/** Runs one task to completion, saves the redacted result, then deletes the task (and its files). */
async function runTask(name: string, route: string, body: unknown, keepResult?: string) {
  const create = await api("POST", route, body);
  const taskId = (create.body as { data?: { task_id?: string } })?.data?.task_id;
  if (!taskId) {
    save(`${name}-create-error`, create.body);
    return;
  }
  // Task ids stay in the gitignored raw folder so a slow task can be collected or deleted later.
  const pending = path.join(RAW, "pending-tasks.json");
  const tasks: Record<string, { route: string; taskId: string }> = fs.existsSync(pending)
    ? JSON.parse(fs.readFileSync(pending, "utf8"))
    : {};
  tasks[name] = { route, taskId };
  fs.writeFileSync(pending, JSON.stringify(tasks, null, 2));
  await finish(name, route, taskId, keepResult);
}

/** Polls up to ~2 min (observed: frizz and density can run past 33 s), saves, then deletes. */
async function finish(name: string, route: string, taskId: string, keepResult?: string) {
  const started = Date.now();
  let last: Call | undefined;
  let status: string | undefined;
  for (const wait of [1000, 2000, 4000, ...Array<number>(28).fill(4000)]) {
    await new Promise((r) => setTimeout(r, wait));
    last = await api("GET", `${route}/${taskId}`);
    status = (last.body as { data?: { task_status?: string } })?.data?.task_status;
    if (status && status !== "running") break;
  }
  console.log(`  ${name}: ${status} after ${Date.now() - started} ms`);
  save(name, { latency_ms: Date.now() - started, response: last?.body });
  if (status === "running") return; // still pending; run "collect" later

  // Result image goes to the gitignored private folder for a visual check, never to the repo.
  const resultUrl = (last?.body as { data?: { results?: { url?: string } } })?.data?.results?.url;
  if (keepResult && resultUrl) {
    const img = await fetch(resultUrl, { signal: AbortSignal.timeout(15_000) });
    if (img.ok) {
      fs.writeFileSync(keepResult, Buffer.from(await img.arrayBuffer()));
      console.log(`  result image → ${path.relative(root, keepResult)}`);
    }
  }

  const del = await api("POST", "/s2s/v2.0/task/delete", { task_id: taskId });
  save("task-delete", del.body);
  const pending = path.join(RAW, "pending-tasks.json");
  if (del.status === 200 && fs.existsSync(pending)) {
    const tasks = JSON.parse(fs.readFileSync(pending, "utf8"));
    delete tasks[name];
    fs.writeFileSync(pending, JSON.stringify(tasks, null, 2));
  }
}

/** Free: re-polls tasks left running by an earlier paid run, then deletes them. */
async function collect() {
  const pending = path.join(RAW, "pending-tasks.json");
  const tasks: Record<string, { route: string; taskId: string }> = fs.existsSync(pending)
    ? JSON.parse(fs.readFileSync(pending, "utf8"))
    : {};
  if (!Object.keys(tasks).length) console.log("No pending tasks.");
  for (const [name, t] of Object.entries(tasks)) await finish(name, t.route, t.taskId);
}

const SHOTS = ["front", "left", "right", "down"] as const;
type Shot = (typeof SHOTS)[number];

/** Finds front/left/right/down.{jpg,jpeg,png,webp} in the folder. */
function findShots(dir: string): Partial<Record<Shot, string>> {
  const files = fs.readdirSync(dir);
  return Object.fromEntries(
    SHOTS.flatMap((shot) => {
      const hit = files.find((f) => new RegExp(`^${shot}\.(jpe?g|png|webp)$`, "i").test(f));
      return hit ? [[shot, path.join(dir, hit)]] : [];
    }),
  );
}

async function paid(dir: string, only: Set<string>, templateId?: string) {
  const shots = findShots(dir);
  const want = (name: string) => only.size === 0 || only.has(name);
  const start = await credit();
  console.log(`Balance before: ${start}`);

  const ids: Partial<Record<Shot, string>> = {};
  const fileId = async (shot: Shot) => {
    if (!shots[shot]) throw new Error(`missing ${shot} photo in ${dir}`);
    return (ids[shot] ??= await upload(shots[shot]));
  };

  const spent: Record<string, number | null> = {};
  let prev = start;
  const step = async (name: string, route: string, body: () => Promise<unknown>, keep?: string) => {
    if (!want(name)) return;
    await runTask(name, route, await body(), keep);
    const now = await credit();
    spent[name] = prev !== null && now !== null ? Math.round((prev - now) * 100) / 100 : null;
    prev = now;
  };

  // Observed 2026-10-31: type and frizz need exactly 3 ids in the order front, right, left;
  // length and density take one id. Density wants the head lowered ~45° (hairline visible).
  const threeViews = async () => ({ src_file_ids: [await fileId("front"), await fileId("right"), await fileId("left")] });
  await step("type", "/s2s/v2.0/task/hair-type-detection", threeViews);
  await step("frizz", "/s2s/v2.0/task/hair-frizziness-detection", threeViews);
  await step("length", "/s2s/v2.0/task/hair-length-detection", async () => ({ src_file_id: await fileId("front") }));
  await step("density", "/s2s/v2.0/task/hair-density-detection", async () => ({ src_file_id: await fileId("down") }));
  if (templateId) {
    await step(
      "tryon",
      "/s2s/v2.1/task/hair-transfer",
      async () => ({ src_file_id: await fileId("front"), template_id: templateId, hair_color: "src" }),
      path.join(dir, "tryon-result.jpg"),
    );
  }
  console.log("Units spent per call (balance difference):", spent);
  const log = path.join(SAMPLES, "units-observed.json");
  const previous = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, "utf8")) : {};
  save("units-observed", { ...previous, [new Date().toISOString()]: spent });
}

const [mode, ...args] = process.argv.slice(2);
const flag = args.find((a) => a.startsWith("--only="));
const only = new Set(flag ? flag.slice(7).split(",") : []);
const [dir, templateId] = args.filter((a) => !a.startsWith("--"));
const run = mode === "free" ? free() : mode === "collect" ? collect() : mode === "paid" && dir ? paid(path.resolve(dir), only, templateId) : null;
if (!run) {
  console.error("usage: probe-youcam.ts free | collect | paid <folder> [template_id] [--only=type,frizz,length,density,tryon]");
  process.exit(1);
}
run.catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "probe failed");
  process.exit(1);
});
