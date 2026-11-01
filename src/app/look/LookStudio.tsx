"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { common } from "@/copy/common";
import { demoCopy, lookCopy } from "@/copy/journey";
import { postJson } from "@/lib/client/api";
import { prepareBodyPhoto, type BodyIssue } from "@/lib/client/photo";
import { resultMemory } from "@/lib/client/result-memory";
import { useIsDemo, useStoredProfile } from "@/lib/client/session-store";
import { useTurnstile } from "@/lib/client/turnstile";
import { DEMO_IMAGES } from "@/lib/demo/fixtures";

// Look: a separately consented full-body photo, then an
// occasion's outfit and shoes, one request per vendor step so each shows as it finishes.
// The hair try-on sits beside it. Partial results are shown honestly.

type ErrorKey = keyof typeof lookCopy.errors;
type StepState = { s: "waiting" } | { s: "running" } | { s: "done"; src: string } | { s: "failed"; key: ErrorKey };
type Photo = { s: "none" } | { s: "checking" } | { s: "uploading" } | { s: "ready" } | { s: "issues"; issues: BodyIssue[] } | { s: "error"; key: ErrorKey };

export interface Occasion {
  id: string;
  name: string;
  outfit: string;
  style: "masculine" | "feminine";
}

const asKey = (e: string): ErrorKey => (e in lookCopy.errors ? (e as ErrorKey) : "try_again");

export function LookStudio({ occasions }: { occasions: Occasion[] }) {
  const cutId = useSearchParams().get("cut") ?? "";
  const demo = useIsDemo();
  const profile = useStoredProfile();
  const { container, getToken } = useTurnstile();
  const [consented, setConsented] = useState(false);
  const [photo, setPhoto] = useState<Photo>({ s: "none" });
  const [occasion, setOccasion] = useState<string | null>(null);
  const [style, setStyle] = useState<Occasion["style"]>("masculine");
  const [clothes, setClothes] = useState<StepState>({ s: "waiting" });
  const [shoes, setShoes] = useState<StepState>({ s: "waiting" });
  const hair = cutId ? resultMemory.tryOn(cutId) : null;
  const ready = demo || photo.s === "ready";
  const busy = clothes.s === "running" || shoes.s === "running" || photo.s === "checking" || photo.s === "uploading";

  async function choosePhoto(file: File) {
    setPhoto({ s: "checking" });
    try {
      const prepared = await prepareBodyPhoto(file);
      if (!prepared.upload) return setPhoto({ s: "issues", issues: prepared.issues });
      setPhoto({ s: "uploading" });
      const form = new FormData();
      form.append("image", prepared.upload, "body.jpg");
      const token = await getToken();
      if (token) form.append("turnstileToken", token);
      const res = await fetch("/api/look/photo", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setPhoto(res.ok ? { s: "ready" } : { s: "error", key: asKey(body.error ?? "") });
    } catch {
      setPhoto({ s: "error", key: navigator.onLine ? "try_again" : "offline" });
    }
  }

  async function run(id: string) {
    setOccasion(id);
    setClothes({ s: "running" });
    setShoes({ s: "waiting" });
    if (demo) {
      setClothes({ s: "done", src: DEMO_IMAGES.clothes });
      setShoes({ s: "done", src: DEMO_IMAGES.shoes });
      return;
    }
    const c = await postJson<{ image: string }>("/api/look/clothes", { occasion: id });
    setClothes(c.ok ? { s: "done", src: c.data.image } : { s: "failed", key: asKey(c.error) });
    if (!c.ok && (c.error === "photo_needed" || c.error === "budget_exhausted" || c.error === "rate_limited")) {
      if (c.error === "photo_needed") setPhoto({ s: "none" });
      return;
    }
    setShoes({ s: "running" });
    const s = await postJson<{ image: string }>("/api/look/shoes", { occasion: id });
    setShoes(s.ok ? { s: "done", src: s.data.image } : { s: "failed", key: asKey(s.error) });
  }

  if (profile === undefined) return <p className="text-muted">…</p>;
  const finalImage = shoes.s === "done" ? shoes.src : clothes.s === "done" ? clothes.src : null;
  const chosen = occasions.find((o) => o.id === occasion);

  return (
    <div className="flex flex-col gap-4">
      {demo && <p className="text-sm text-warn">{lookCopy.demoNote}</p>}

      {!demo && !ready && (
        <section className="card flex flex-col gap-3" aria-labelledby="look-photo">
          <h2 id="look-photo" className="font-semibold">
            {lookCopy.photoTitle}
          </h2>
          <p className="text-sm">{lookCopy.consent}</p>
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" className="size-5" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
            <span>{lookCopy.consentCheck}</span>
          </label>
          <p className="text-sm text-muted">{lookCopy.photoGuide}</p>
          <label className={`btn-primary cursor-pointer ${!consented || busy ? "pointer-events-none opacity-50" : ""}`}>
            {lookCopy.choosePhoto}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              disabled={!consented || busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void choosePhoto(file);
              }}
            />
          </label>
          <div aria-live="polite">
            {photo.s === "checking" && <p className="text-muted">{lookCopy.checking}</p>}
            {photo.s === "uploading" && <p className="text-muted">{lookCopy.uploading}</p>}
            {photo.s === "issues" && (
              <ul className="card flex flex-col gap-1 border-warn bg-warn-bg text-warn">
                {photo.issues.map((i) => (
                  <li key={i}>{lookCopy.gate[i]}</li>
                ))}
              </ul>
            )}
            {photo.s === "error" && <ErrorCard text={lookCopy.errors[photo.key]} offerDemo={photo.key === "rate_limited" || photo.key === "budget_exhausted"} />}
          </div>
        </section>
      )}

      {ready && (
        <section aria-labelledby="look-occasion" className="flex flex-col gap-2">
          <h2 id="look-style" className="font-semibold">
            {lookCopy.styleTitle}
          </h2>
          <div role="group" aria-labelledby="look-style" className="grid grid-cols-2 gap-2">
            {(["masculine", "feminine"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={style === s}
                disabled={busy}
                onClick={() => setStyle(s)}
                className={style === s ? "btn-primary px-2" : "btn-secondary px-2"}
              >
                {lookCopy.styles[s]}
              </button>
            ))}
          </div>
          <h2 id="look-occasion" className="font-semibold">
            {lookCopy.occasionTitle}
          </h2>
          <div role="group" aria-labelledby="look-occasion" className="grid grid-cols-3 gap-2">
            {occasions.filter((o) => o.style === style).map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={occasion === o.id}
                disabled={busy}
                onClick={() => void run(o.id)}
                className={occasion === o.id ? "btn-primary px-2" : "btn-secondary px-2"}
              >
                {o.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {chosen && (
        <section className="flex flex-col gap-3" aria-live="polite">
          <ol className="grid grid-cols-2 gap-2 text-sm">
            <StepChip label={`${lookCopy.outfitStep}: ${chosen.outfit}`} state={clothes} />
            <StepChip label={lookCopy.shoesStep} state={shoes} />
          </ol>
          {(clothes.s === "running" || shoes.s === "running") && <p className="text-muted">{lookCopy.running}</p>}
          {clothes.s === "failed" && <ErrorCard text={lookCopy.errors[clothes.key]} offerDemo={clothes.key === "rate_limited" || clothes.key === "budget_exhausted"} />}
          {clothes.s === "done" && shoes.s === "failed" && <p className="card text-sm">{lookCopy.shoesPartial}</p>}

          {finalImage && (
            <div className="grid grid-cols-2 gap-2">
              <figure className="flex flex-col gap-1">
                <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-surface">
                  {hair || demo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- session-bound result served by /api/image
                    <img src={hair ?? DEMO_IMAGES.tryon} alt={lookCopy.hairBeside} className="size-full object-cover" />
                  ) : (
                    <p className="p-3 text-sm text-muted">{lookCopy.hairMissing}</p>
                  )}
                </div>
                <figcaption className="text-xs text-muted">{lookCopy.hairBeside}</figcaption>
              </figure>
              <figure className="flex flex-col gap-1">
                <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element -- session-bound result served by /api/image */}
                  <img src={finalImage} alt={chosen.outfit} className="size-full object-cover" />
                </div>
                <figcaption className="text-xs text-muted">{chosen.name}</figcaption>
              </figure>
            </div>
          )}
          <p className="text-sm text-muted">{common.previewLabel}</p>
        </section>
      )}

      <Link href={cutId ? `/kit?cut=${cutId}` : "/verdict"} className={finalImage ? "btn-primary" : "btn-secondary"}>
        {finalImage ? lookCopy.keepIt : lookCopy.skip}
      </Link>
      <div ref={container} />
    </div>
  );
}

function StepChip({ label, state }: { label: string; state: StepState }) {
  const status = { waiting: lookCopy.waiting, running: "…", done: lookCopy.done, failed: lookCopy.failed }[state.s];
  const tone = state.s === "done" ? "bg-ok-bg text-ok" : state.s === "failed" ? "bg-no-bg text-no" : "bg-surface text-muted";
  return (
    <li className={`rounded-xl border border-line px-3 py-2 ${tone}`}>
      <span className="block font-medium">{label}</span>
      <span>{status}</span>
    </li>
  );
}

function ErrorCard({ text, offerDemo }: { text: string; offerDemo: boolean }) {
  return (
    <div className="card flex flex-col gap-2 border-no bg-no-bg text-no" role="alert">
      <p>{text}</p>
      {offerDemo && (
        <Link href="/demo" className="underline">
          {demoCopy.offer}
        </Link>
      )}
    </div>
  );
}
