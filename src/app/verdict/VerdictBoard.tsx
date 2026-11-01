"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readingsCopy, verdictBoardCopy } from "@/copy/screens";
import { BarberScript } from "@/components/BarberScript";
import { pickCopy, verdictCopy } from "@/copy/verdict";
import { sessionState, useStoredProfile } from "@/lib/client/session-store";
import { DENSITY_LEVELS, type HairProfile, type HairType } from "@/lib/hair/types";
import type { Severity, Verdict } from "@/lib/verdict/engine";
import { pickBest, type Pick } from "@/lib/verdict/pick";

export interface CutSummary {
  id: string;
  name: string;
  blurb: string;
  trend2026: boolean;
  photo: string;
  types: HairType[];
  trimWeeks: number;
  dailyMinutes: number;
  barber: { top: string; sides: string; notes: string };
}

// Icons are always paired with a text label, never colour or symbol alone.
const BADGE: Record<Severity, { icon: string; className: string }> = {
  works: { icon: "✓", className: "bg-ok-bg text-ok" },
  caution: { icon: "!", className: "bg-warn-bg text-warn" },
  inconclusive: { icon: "?", className: "bg-unknown-bg text-unknown" },
  no: { icon: "✗", className: "bg-no-bg text-no" },
};
const ORDER: Severity[] = ["works", "caution", "inconclusive", "no"];

type Load =
  | { state: "loading" }
  | { state: "error" }
  | { state: "done"; verdicts: Verdict[] };

export function VerdictBoard({ cuts }: { cuts: CutSummary[] }) {
  const profile = useStoredProfile();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [onlyWorking, setOnlyWorking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Safe as an initial value: the board renders only after the profile loads on the client.
  const [audience, setAudience] = useState(() =>
    typeof window === "undefined" ? "" : sessionState.audience(),
  );

  useEffect(() => {
    if (!profile) return;
    const controller = new AbortController();
    fetch(audience ? `/api/verdict?audience=${audience}` : "/api/verdict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { verdicts: Verdict[] };
        setLoad({ state: "done", verdicts: body.verdicts });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoad({ state: "error" });
        void e;
      });
    return () => controller.abort();
  }, [profile, attempt, audience]);

  const byId = useMemo(() => new Map(cuts.map((c) => [c.id, c])), [cuts]);
  const names = useMemo(() => new Map(cuts.map((c) => [c.id, c.name])), [cuts]);

  if (profile === undefined) return <p className="text-muted">…</p>;
  if (profile === null) {
    return (
      <div className="card flex flex-col gap-3">
        <p>{readingsCopy.missing}</p>
        <Link href="/scan" className="btn-primary">
          {readingsCopy.startScan}
        </Link>
      </div>
    );
  }
  if (load.state === "loading")
    return (
      <p className="text-muted" aria-live="polite">
        {verdictBoardCopy.loading}
      </p>
    );
  if (load.state === "error") {
    return (
      <div className="card flex flex-col gap-3" role="alert">
        <p>{verdictBoardCopy.error}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setLoad({ state: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          {verdictBoardCopy.retry}
        </button>
      </div>
    );
  }

  const sorted = [...load.verdicts].sort(
    (a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict),
  );
  const shown = onlyWorking
    ? sorted.filter((v) => v.verdict === "works" || v.verdict === "caution")
    : sorted;
  const anyGrowth = load.verdicts.some((v) => v.growthWeeks);
  const userEdited = hasUserEdits(profile);
  const hairType =
    profile.type.status === "ok" ? profile.type.value : undefined;
  const picks = pickBest(load.verdicts, cuts, hairType);
  const unread = (["type", "length", "frizz", "density"] as const)
    .filter((k) => {
      const r = profile[k];
      return r.status === "inconclusive" && r.reason !== "manual";
    })
    .map((k) => readingsCopy.names[k].toLowerCase());

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label={verdictBoardCopy.audienceLabel}
        className="grid grid-cols-3 gap-2"
      >
        {(["", "men", "women"] as const).map((a) => (
          <button
            key={a || "everyone"}
            type="button"
            aria-pressed={audience === a}
            onClick={() => {
              sessionState.setAudience(a);
              setAudience(a);
            }}
            className={
              audience === a ? "btn-primary px-2" : "btn-secondary px-2"
            }
          >
            {verdictBoardCopy.audiences[a || "everyone"]}
          </button>
        ))}
      </div>
      <div
        role="group"
        aria-label="Filter cuts"
        className="grid grid-cols-2 gap-2"
      >
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={onlyWorking === value}
            onClick={() => setOnlyWorking(value)}
            className={onlyWorking === value ? "btn-primary" : "btn-secondary"}
          >
            {value ? verdictBoardCopy.filterWorks : verdictBoardCopy.filterAll}
          </button>
        ))}
      </div>

      {profile.density.status === "inconclusive" &&
        profile.density.reason === "manual" && (
          <div
            className="card flex flex-col gap-2 border-warn bg-warn-bg text-warn"
            role="status"
          >
            <p>{verdictBoardCopy.pickDensity}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {DENSITY_LEVELS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="btn-secondary flex flex-col items-start text-left"
                  onClick={() => sessionState.saveProfile({ ...profile, density: { status: "ok", value: d, source: "user" } })}
                >
                  <span className="font-semibold">{readingsCopy.values.density[d]}</span>
                  <span className="text-sm font-normal">{verdictBoardCopy.densityHints[d]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      {unread.length > 0 && (
        <div
          className="card flex flex-col gap-2 border-warn bg-warn-bg text-warn"
          role="status"
        >
          <p>{verdictBoardCopy.unread(unread.join(" and "))}</p>
          <Link href="/readings" className="btn-primary">
            {verdictBoardCopy.setReading}
          </Link>
        </div>
      )}
      {userEdited && (
        <p className="text-sm text-muted">{verdictBoardCopy.basedOnYou}</p>
      )}

      {picks.length > 0 && (
        <TopPick picks={picks} byId={byId} type={hairType} />
      )}

      <ul className="flex flex-col gap-3">
        {shown.map((v) => (
          <li key={v.cutId} id={`cut-${v.cutId}`}>
            <VerdictCard
              verdict={v}
              cut={byId.get(v.cutId)}
              type={hairType}
              names={names}
            />
          </li>
        ))}
      </ul>

      {anyGrowth && (
        <p className="text-sm text-muted">{verdictBoardCopy.growthNote}</p>
      )}
      <div className="flex flex-col gap-3">
        <Link href="/how-we-decide" className="btn-secondary">
          {verdictBoardCopy.howWeDecide}
        </Link>
        <Link href="/readings" className="btn-secondary">
          {verdictBoardCopy.editReadings}
        </Link>
      </div>
    </div>
  );
}

function hasUserEdits(p: HairProfile): boolean {
  return [p.type, p.length, p.frizz, p.density].some(
    (r) => r.status === "ok" && r.source === "user",
  );
}

function TopPick({
  picks,
  byId,
  type,
}: {
  picks: Pick[];
  byId: Map<string, CutSummary>;
  type?: HairType;
}) {
  const [best, ...more] = picks;
  const cut = byId.get(best.cutId);
  if (!cut) return null;
  return (
    <section
      aria-labelledby="top-pick"
      className="overflow-hidden rounded-[2rem] border border-line bg-surface"
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- YouCam template preview, served from our domain */}
        <img
          src={cut.photo}
          alt={cut.name}
          className="aspect-[5/4] w-full object-cover object-[50%_18%]"
        />
        <p className="eyebrow absolute left-4 top-4 rounded-full bg-surface/90 px-3 py-1.5 text-accent backdrop-blur">
          {pickCopy.eyebrow}
        </p>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2
            id="top-pick"
            className="font-display text-3xl font-semibold leading-tight"
          >
            {cut.name}
          </h2>
          <p className="mt-1 text-muted">{cut.blurb}</p>
        </div>
        <div>
          <p className="font-semibold">{pickCopy.why}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {best.reasons.map((r) => (
              <li key={r.kind} className="flex gap-2.5 leading-snug">
                <span aria-hidden="true" className="mt-0.5 text-accent">
                  ✦
                </span>
                {pickCopy.reason(r)}
              </li>
            ))}
          </ul>
        </div>
        <Link href={`/tryon?cut=${cut.id}`} className="btn-primary">
          {pickCopy.tryOn}
        </Link>
        <BarberScript name={cut.name} barber={cut.barber} type={type} />
        {more.length > 0 && (
          <div>
            <p className="eyebrow">{pickCopy.alsoGreat}</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {more.map((m) => {
                const alt = byId.get(m.cutId);
                return alt ? (
                  <a
                    key={m.cutId}
                    href={`#cut-${m.cutId}`}
                    className="group flex flex-col gap-1.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- YouCam template preview */}
                    <img
                      src={alt.photo}
                      alt=""
                      className="aspect-square w-full rounded-2xl object-cover object-top transition-transform group-hover:scale-[1.02]"
                    />
                    <span className="text-sm font-semibold underline-offset-4 group-hover:underline">
                      {alt.name}
                    </span>
                  </a>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function VerdictCard({
  verdict: v,
  cut,
  type,
  names,
}: {
  verdict: Verdict;
  cut?: CutSummary;
  type?: HairType;
  names: Map<string, string>;
}) {
  const name = cut?.name ?? v.cutId;
  const badge = BADGE[v.verdict];
  const label = verdictCopy.labels[v.verdict];
  const summary = v.reasons[0] ?? label;

  return (
    <details className="card group">
      <summary className="flex min-h-12 cursor-pointer list-none items-start gap-3">
        <span
          className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-base font-bold ${badge.className}`}
          aria-hidden="true"
        >
          {badge.icon}
        </span>
        {cut && (
          // eslint-disable-next-line @next/next/no-img-element -- YouCam template preview
          <img
            src={cut.photo}
            alt=""
            className="size-16 shrink-0 rounded-2xl object-cover object-top"
          />
        )}
        <span className="flex-1">
          <span className="block font-semibold">{name}</span>
          <span className="block text-sm text-muted">{cut?.blurb}</span>
          <span
            className={`text-sm font-medium ${badge.className.split(" ")[1]}`}
          >
            {label}
          </span>
          {v.reasons.length > 0 && (
            <span className="mt-1 block text-sm text-muted">{summary}</span>
          )}
        </span>
        <span
          aria-hidden="true"
          className="text-muted transition-transform group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>

      <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
        {v.reasons.length > 1 && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {v.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {v.verdict === "no" && v.closestAlternative && (
          <p className="text-sm">
            {verdictBoardCopy.closest}{" "}
            <a
              href={`#cut-${v.closestAlternative}`}
              className="font-semibold text-accent underline"
            >
              {names.get(v.closestAlternative)}
            </a>
          </p>
        )}
        {(v.verdict === "works" || v.verdict === "caution") && cut && (
          <BarberScript name={name} barber={cut.barber} type={type} />
        )}
        {(v.verdict === "works" || v.verdict === "caution") && (
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/tryon?cut=${v.cutId}`} className="btn-primary">
              {verdictBoardCopy.tryOn}
            </Link>
            <Link href={`/kit?cut=${v.cutId}`} className="btn-secondary">
              {verdictBoardCopy.getKit}
            </Link>
          </div>
        )}
      </div>
    </details>
  );
}
