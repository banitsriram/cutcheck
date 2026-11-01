"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteCopy } from "@/copy/journey";
import { postJson } from "@/lib/client/api";
import { photoMemory } from "@/lib/client/photo-memory";
import { resultMemory } from "@/lib/client/result-memory";
import { sessionState } from "@/lib/client/session-store";

// Delete: one tap clears this tab, then the server's references and
// YouCam tasks, and lists exactly what was removed.

interface Removed {
  removed: { photo: boolean; bodyPhoto: boolean; resultImages: number };
  vendor: { requested: number; deleted: number };
}

type State = { s: "idle" } | { s: "working" } | { s: "done"; result: Removed | null };

export function DeleteAll() {
  const [state, setState] = useState<State>({ s: "idle" });

  async function run() {
    setState({ s: "working" });
    // The tab goes first, so it's cleared even if the network fails.
    sessionState.clearAll();
    photoMemory.clear();
    resultMemory.clear();
    const r = await postJson<Removed>("/api/delete", {});
    setState({ s: "done", result: r.ok ? r.data : null });
  }

  if (state.s === "done") {
    const r = state.result;
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <h2 className="text-lg font-semibold">{deleteCopy.doneTitle}</h2>
        <ul className="card flex list-disc flex-col gap-1 pl-8">
          <li>{deleteCopy.removedTab}</li>
          {r?.removed.photo && <li>{deleteCopy.removedPhoto}</li>}
          {r?.removed.bodyPhoto && <li>{deleteCopy.removedBody}</li>}
          {r && r.removed.resultImages > 0 && <li>{deleteCopy.removedImages(r.removed.resultImages)}</li>}
        </ul>
        {r ? (
          <>
            {r.vendor.requested > 0 && <p>{deleteCopy.vendor(r.vendor.deleted, r.vendor.requested)}</p>}
            <p className="text-sm text-muted">{deleteCopy.vendorRetention}</p>
          </>
        ) : (
          <p className="card border-no bg-no-bg text-no" role="alert">
            {deleteCopy.error}
          </p>
        )}
        <Link href="/" className="btn-secondary">
          {deleteCopy.home}
        </Link>
      </div>
    );
  }

  return (
    <button type="button" className="btn-primary" onClick={run} disabled={state.s === "working"}>
      {state.s === "working" ? deleteCopy.working : deleteCopy.button}
    </button>
  );
}
