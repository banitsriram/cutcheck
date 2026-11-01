import { Screen } from "@/components/Screen";
import { consentCopy } from "@/copy/screens";
import { ConsentForm } from "./ConsentForm";

export const metadata = { title: "Before we start | CutCheck" };

// Consent: what is sent, what we keep, how to delete. Shown before any camera access.
export default function ConsentPage() {
  return (
    <Screen step={0} title={consentCopy.title} intro={consentCopy.intro}>
      <ul className="card flex list-disc flex-col gap-3 pl-8">
        {consentCopy.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <ConsentForm />
    </Screen>
  );
}
