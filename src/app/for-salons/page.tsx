import Link from "next/link";
import { Screen } from "@/components/Screen";
import { common } from "@/copy/common";
import { salonsCopy } from "@/copy/journey";

export const metadata = { title: "For salons and brands | CutCheck" };

// Business value: what the flow offers and what a pilot would measure. No invented metrics.
export default function SalonsPage() {
  return (
    <Screen title={salonsCopy.title} intro={salonsCopy.intro}>
      <div className="flex flex-col gap-3">
        {salonsCopy.points.map((p) => (
          <section key={p.heading} className="card">
            <h2 className="font-semibold">{p.heading}</h2>
            <p className="mt-1 text-muted">{p.body}</p>
          </section>
        ))}
        <section className="card">
          <h2 className="font-semibold">{salonsCopy.measureTitle}</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {salonsCopy.measure.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">{salonsCopy.note}</p>
        </section>
        <Link href="/demo" className="btn-primary">
          {common.ctaDemo}
        </Link>
      </div>
    </Screen>
  );
}
