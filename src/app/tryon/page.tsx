import { Suspense } from "react";
import { Screen } from "@/components/Screen";
import { tryOnCopy } from "@/copy/journey";
import { CUTS, previewTemplate } from "@/lib/verdict/rules";
import { TryOnStudio } from "./TryOnStudio";

export const metadata = { title: "Try it on | CutCheck" };

// Try-on. The cut comes from ?cut=; names come from the server's cut list.
export default function TryOnPage() {
  const cuts = CUTS.map((c) => ({
    id: c.id,
    name: c.name,
    referenceImage: c.referenceImage,
    keepsColour: c.keepsColour,
    // What a curly/coily person gets (null: no curly model); template ids stay on the server.
    curly: previewTemplate(c, "curly") && { keepsColour: previewTemplate(c, "curly")!.keepsColour },
  }));
  return (
    <Screen step={2} title={tryOnCopy.title} intro={tryOnCopy.intro}>
      <Suspense fallback={<p className="text-muted">…</p>}>
        <TryOnStudio cuts={cuts} />
      </Suspense>
    </Screen>
  );
}
