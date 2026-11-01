"use client";

import { captureCopy } from "@/copy/screens";
import { useIsMock } from "@/lib/client/session-store";

/** Labels stand-in readings so they're never mistaken for real API output. */
export function MockNotice() {
  if (!useIsMock()) return null;
  return <p className="card mb-4 border-warn bg-warn-bg text-sm text-warn">{captureCopy.mockNotice}</p>;
}
