"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { common } from "@/copy/common";
import { demoCopy, tryOnCopy } from "@/copy/journey";
import { postJson, reuploadFront } from "@/lib/client/api";
import { photoMemory } from "@/lib/client/photo-memory";
import { resultMemory } from "@/lib/client/result-memory";
import { useIsDemo, useStoredProfile } from "@/lib/client/session-store";
import { useTurnstile } from "@/lib/client/turnstile";
import { DEMO_IMAGES } from "@/lib/demo/fixtures";
import type { Verdict } from "@/lib/verdict/engine";

// Try-on: one cut on the user's own front photo, colour kept (v2.1).
// Only ✓ and ⚠ cuts can be tried on: the analysis limits the try-on, not the other way round.

type ErrorKey = keyof typeof tryOnCopy.errors;
type State =
  | { s: "idle" }
  | { s: "running" }
  | { s: "done"; src: string }
  | { s: "error"; key: ErrorKey }
  | { s: "noPhoto" };

export interface CutName {
  id: string;
  name: string;
  referenceImage: string;
  keepsColour: boolean;
  curly: { keepsColour: boolean } | null;
}

export function TryOnStudio({ cuts }: { cuts: CutName[] }) {
  const cutId = useSearchParams().get("cut") ?? "";
  const cut = cuts.find((c) => c.id === cutId);
  const profile = useStoredProfile();
  const demo = useIsDemo();
  const { container, getToken } = useTurnstile();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [state, setState] = useState<State>(() => {
    const cached = cut ? resultMemory.tryOn(cut.id) : null;
    return cached ? { s: "done", src: cached } : { s: "idle" };
  });

  // The verdict decides whether a try-on is offered at all.
  useEffect(() => {
    if (!cut || !profile) return;
    const controller = new AbortController();
    postJson<{ verdict: Verdict }>("/api/kit", { cutId: cut.id, profile }, controller.signal).then((r) => {
      if (r.ok) setVerdict(r.data.verdict);
    });
    return () => controller.abort();
  }, [cut, profile]);

  const before = useBlobUrl(demo ? null : photoMemory.get());
  const hairType = profile?.type.status === "ok" ? profile.type.value : undefined;
  const isCurly = hairType === "curly" || hairType === "coily";

  if (!cut) return <Missing text={tryOnCopy.noCut} />;
  if (profile === undefined) return <p className="text-muted">…</p>;
  if (profile === null) return <Missing text={tryOnCopy.noCut} />;
  if (verdict?.verdict === "no") {
    return (
      <div className="card flex flex-col gap-3">
        <p>{tryOnCopy.notForYou}</p>
        <Link href={`/verdict#cut-${cut.id}`} className="btn-secondary">
          {tryOnCopy.backToVerdicts}
        </Link>
      </div>
    );
  }

  if (isCurly && !cut.curly) {
    return (
      <div className="card flex flex-col gap-3">
        <p>{tryOnCopy.noCurlyModel}</p>
        <Link href={`/kit?cut=${cut.id}`} className="btn-primary">
          {tryOnCopy.getKit}
        </Link>
        <Link href={`/verdict#cut-${cut.id}`} className="btn-secondary">
          {tryOnCopy.backToVerdicts}
        </Link>
      </div>
    );
  }

  async function generate() {
    if (!cut) return;
    if (demo) {
      setState({ s: "done", src: DEMO_IMAGES.tryon });
      return;
    }
    setState({ s: "running" });
    let r = await postJson<{ image: string }>("/api/tryon/hair", { cutId: cut.id, hairType });
    if (!r.ok && r.error === "rescan_needed") {
      // The server's 30-minute reference expired; re-send the photo held in this tab and retry once.
      if (!(await reuploadFront(await getToken()))) return setState({ s: "noPhoto" });
      r = await postJson<{ image: string }>("/api/tryon/hair", { cutId: cut.id, hairType });
    }
    if (r.ok) {
      resultMemory.setTryOn(cut.id, r.data.image);
      setState({ s: "done", src: r.data.image });
    } else {
      setState({ s: "error", key: r.error in tryOnCopy.errors ? (r.error as ErrorKey) : "try_again" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{cut.name}</h2>
      {(isCurly ? cut.curly?.keepsColour : cut.keepsColour) ? (
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-ok-bg px-3 py-1 text-sm font-medium text-ok">
          <span aria-hidden="true">✓</span> {tryOnCopy.colourKept}
        </p>
      ) : (
        <p className="w-fit rounded-full bg-unknown-bg px-3 py-1 text-sm font-medium text-unknown">{tryOnCopy.colourFromStyle}</p>
      )}

      {state.s === "done" ? (
        <BeforeAfter before={before} after={state.src} />
      ) : (
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface">
          {before ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview of the user's own photo
            <img src={before} alt={tryOnCopy.before} className="size-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- YouCam template preview of the style
            <img src={cut.referenceImage} alt={tryOnCopy.reference(cut.name)} className="size-full object-cover" />
          )}
        </div>
      )}
      <p className="text-sm text-muted">{common.previewLabel}</p>
      {demo && <p className="text-sm text-warn">{tryOnCopy.demoNote}</p>}

      <div aria-live="polite">
        {state.s === "running" && <p className="text-muted">{tryOnCopy.generating}</p>}
        {state.s === "error" && (
          <div className="card flex flex-col gap-2 border-no bg-no-bg text-no" role="alert">
            <p>{tryOnCopy.errors[state.key]}</p>
            {(state.key === "rate_limited" || state.key === "budget_exhausted") && (
              <Link href="/demo" className="underline">
                {demoCopy.offer}
              </Link>
            )}
          </div>
        )}
        {state.s === "noPhoto" && (
          <div className="card flex flex-col gap-2" role="alert">
            <p>{tryOnCopy.noPhoto}</p>
            <Link href="/scan" className="btn-secondary">
              {tryOnCopy.rescan}
            </Link>
          </div>
        )}
      </div>

      <button type="button" className="btn-primary" onClick={generate} disabled={state.s === "running"}>
        {state.s === "done" || state.s === "error" ? tryOnCopy.regenerate : tryOnCopy.generate}
      </button>
      {state.s === "done" && (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/look?cut=${cut.id}`} className="btn-primary">
            {tryOnCopy.wearIt}
          </Link>
          <Link href={`/kit?cut=${cut.id}`} className="btn-secondary">
            {tryOnCopy.keepIt}
          </Link>
        </div>
      )}
      <Link href="/verdict" className="btn-secondary">
        {tryOnCopy.backToVerdicts}
      </Link>
      <div ref={container} />
    </div>
  );
}

function Missing({ text }: { text: string }) {
  return (
    <div className="card flex flex-col gap-3">
      <p>{text}</p>
      <Link href="/verdict" className="btn-secondary">
        {tryOnCopy.backToVerdicts}
      </Link>
    </div>
  );
}

/** Object URL for an in-memory blob, revoked when it changes or the screen unmounts. */
function useBlobUrl(blob: Blob | null): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

/** Before/after comparison: a range input moves the split, so it works by keyboard too. */
function BeforeAfter({ before, after }: { before: string | null; after: string }) {
  const [split, setSplit] = useState(50);
  if (!before) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- session-bound result served by /api/image */}
        <img src={after} alt={tryOnCopy.after} className="w-full" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- session-bound result served by /api/image */}
        <img src={after} alt={tryOnCopy.after} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview of the user's own photo */}
          <img src={before} alt={tryOnCopy.before} className="size-full object-cover" />
        </div>
        <div aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${split}%` }} />
        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{tryOnCopy.before}</span>
        <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{tryOnCopy.after}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        aria-label={tryOnCopy.slider}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}
