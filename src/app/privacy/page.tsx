import { Screen } from "@/components/Screen";
import { privacyCopy } from "@/copy/screens";

export const metadata = { title: "Privacy | CutCheck" };

export default function PrivacyPage() {
  return (
    <Screen title={privacyCopy.title}>
      <div className="flex flex-col gap-5">
        {privacyCopy.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-semibold">{s.heading}</h2>
            <p className="mt-1 text-muted">{s.body}</p>
          </section>
        ))}
      </div>
    </Screen>
  );
}
