"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { demoCopy } from "@/copy/journey";
import { photoMemory } from "@/lib/client/photo-memory";
import { resultMemory } from "@/lib/client/result-memory";
import { sessionState } from "@/lib/client/session-store";
import { DEMO_PROFILE } from "@/lib/demo/fixtures";

export function StartDemo() {
  const router = useRouter();
  useEffect(() => {
    photoMemory.clear();
    resultMemory.clear();
    sessionState.saveProfile({ ...DEMO_PROFILE }, "demo");
    router.replace("/readings");
  }, [router]);
  return <p className="text-muted" aria-live="polite">{demoCopy.loading}</p>;
}
