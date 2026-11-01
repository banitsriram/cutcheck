"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { readingsCopy } from "@/copy/screens";
import { sessionState, useStoredProfile } from "@/lib/client/session-store";
import {
  DENSITY_LEVELS,
  FRIZZ_LEVELS,
  HAIR_LENGTHS,
  HAIR_TYPES,
  type HairProfile,
  type Reading,
} from "@/lib/hair/types";

// Readings: each reading with YouCam's own wording, correctable inline.
// A correction is stored as source "user", which the verdicts then flag.

const CARDS = [
  { key: "type", options: HAIR_TYPES },
  { key: "length", options: HAIR_LENGTHS },
  { key: "frizz", options: FRIZZ_LEVELS },
  { key: "density", options: DENSITY_LEVELS },
] as const;

type CardKey = (typeof CARDS)[number]["key"];

export function ReadingsBoard() {
  const profile = useStoredProfile();

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

  const update = (key: CardKey, value: string) => {
    const next = { ...profile, [key]: { status: "ok", value, source: "user" } } as HairProfile;
    sessionState.saveProfile(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {CARDS.map(({ key, options }) => (
        <ReadingCard key={key} name={key} reading={profile[key]} options={options} onChange={(v) => update(key, v)} />
      ))}
      <Link href="/verdict" className="btn-primary mt-3">
        {readingsCopy.seeVerdicts}
      </Link>
      <Link href="/scan" className="btn-secondary">
        {readingsCopy.rescan}
      </Link>
    </div>
  );
}

function ReadingCard({
  name,
  reading,
  options,
  onChange,
}: {
  name: CardKey;
  reading: Reading<string>;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(reading.status === "inconclusive");
  const selectId = useId();
  const labels = readingsCopy.values[name] as Record<string, string>;

  return (
    <section className="card" aria-labelledby={`${selectId}-h`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${selectId}-h`} className="text-sm text-muted">
            {readingsCopy.names[name]}
          </h2>
          {reading.status === "ok" ? (
            <>
              <p className="text-lg font-semibold">{labels[reading.value]}</p>
              {reading.source === "api" && reading.term && (
                <p className="text-sm text-muted">
                  {readingsCopy.vendorTerm} {reading.term}
                </p>
              )}
            </>
          ) : (
            <p className="text-lg font-semibold">
              {reading.reason === "manual" ? readingsCopy.manualTitle : readingsCopy.inconclusiveTitle}
            </p>
          )}
        </div>
        {reading.status === "ok" && reading.source === "user" && (
          <span className="shrink-0 rounded-full bg-unknown-bg px-2.5 py-1 text-xs font-medium text-unknown">
            {readingsCopy.edited}
          </span>
        )}
      </div>

      {reading.status === "inconclusive" && (
        <p className="mt-2 text-sm text-muted">
          {readingsCopy.inconclusiveReasons[reading.reason]} {reading.reason !== "manual" && readingsCopy.inconclusiveHelp}
        </p>
      )}

      {editing ? (
        <div className="mt-3">
          <label htmlFor={selectId} className="text-sm">
            {readingsCopy.chooseValue}
          </label>
          <select
            id={selectId}
            className="mt-1 block min-h-12 w-full rounded-xl border border-line bg-surface px-3"
            value={reading.status === "ok" ? reading.value : ""}
            onChange={(e) => onChange(e.target.value)}
          >
            {reading.status !== "ok" && <option value="" disabled>—</option>}
            {options.map((o) => (
              <option key={o} value={o}>
                {labels[o]}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <button type="button" className="mt-2 min-h-11 text-sm text-accent underline" onClick={() => setEditing(true)}>
          {readingsCopy.looksWrong}
        </button>
      )}
    </section>
  );
}
