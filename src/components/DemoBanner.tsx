"use client";

import { useRouter } from "next/navigation";
import { demoCopy } from "@/copy/journey";
import { sessionState, useIsDemo } from "@/lib/client/session-store";

/** Persistent label on every screen while demo mode is on: fixtures are never shown as live. */
export function DemoBanner() {
  const demo = useIsDemo();
  const router = useRouter();
  if (!demo) return null;
  return (
    <div role="status" className="border-b border-warn bg-warn-bg px-4 py-2 text-sm text-warn">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>
          <strong>{demoCopy.banner}</strong> {demoCopy.bannerImages}
        </p>
        <button
          type="button"
          className="underline"
          onClick={() => {
            sessionState.clearAll();
            router.push("/consent");
          }}
        >
          {demoCopy.startReal}
        </button>
      </div>
    </div>
  );
}
