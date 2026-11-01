import { Suspense } from "react";
import { Screen } from "@/components/Screen";
import { lookCopy } from "@/copy/journey";
import { LOOKS } from "@/lib/look/looks";
import { LookStudio } from "./LookStudio";

export const metadata = { title: "See the full look | CutCheck" };

// Look. Occasion names come from data/looks.json; template ids stay on the server.
export default function LookPage() {
  const occasions = LOOKS.map((l) => ({ id: l.id, name: l.name, outfit: l.outfit, style: l.style }));
  return (
    <Screen step={3} title={lookCopy.title} intro={lookCopy.intro}>
      <Suspense fallback={<p className="text-muted">…</p>}>
        <LookStudio occasions={occasions} />
      </Suspense>
    </Screen>
  );
}
