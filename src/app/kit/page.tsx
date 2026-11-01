import { Suspense } from "react";
import { Screen } from "@/components/Screen";
import { kitCopy } from "@/copy/journey";
import { KitView } from "./KitView";

export const metadata = { title: "Keep it | CutCheck" };

// Kit, cart and barber card.
export default function KitPage() {
  return (
    <Screen step={4} title={kitCopy.title} intro={kitCopy.intro}>
      <Suspense fallback={<p className="text-muted">…</p>}>
        <KitView />
      </Suspense>
    </Screen>
  );
}
