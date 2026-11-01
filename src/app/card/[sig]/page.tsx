import type { Metadata } from "next";
import { BarberScript } from "@/components/BarberScript";
import { readingsCopy } from "@/copy/screens";
import { cardCopy } from "@/copy/journey";
import { verifyCard } from "@/lib/card/sign";
import { HAIR_TYPES, type HairType } from "@/lib/hair/types";
import { CUTS } from "@/lib/verdict/rules";

// Barber card: rendered from the signed link alone. No face, no try-on
// image, nothing stored. The link carries the cut id and four reading values.

export const metadata: Metadata = { title: "Stylist card | CutCheck", robots: { index: false, follow: false } };

export default async function CardPage({ params }: PageProps<"/card/[sig]">) {
  const { sig } = await params;
  const payload = verifyCard(decodeURIComponent(sig));
  const cut = payload ? CUTS.find((c) => c.id === payload.c) : undefined;

  if (!payload || !cut) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-12">
        <h1 className="text-2xl font-semibold">{cardCopy.title}</h1>
        <p className="card mt-6" role="alert">
          {cardCopy.invalid}
        </p>
      </main>
    );
  }

  const value = <K extends "type" | "length" | "frizz" | "density">(key: K, v: string) =>
    v === "?" ? cardCopy.unknown : ((readingsCopy.values[key] as Record<string, string>)[v] ?? cardCopy.unknown);
  const readings = [
    [readingsCopy.names.type, value("type", payload.t)],
    [readingsCopy.names.length, value("length", payload.l)],
    [readingsCopy.names.frizz, value("frizz", payload.f)],
    [readingsCopy.names.density, value("density", payload.d)],
  ] as const;

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-10">
      <p className="text-sm text-muted">{cardCopy.title}</p>
      <h1 className="font-display text-4xl font-semibold leading-tight">{cut.name}</h1>
      <p className="mt-2 text-muted">{cardCopy.intro}</p>

      {/* eslint-disable-next-line @next/next/no-img-element -- YouCam template preview of the style, never the user */}
      <img
        src={cut.referenceImage}
        alt={cardCopy.reference(cut.name)}
        className="mt-6 aspect-[4/5] w-full rounded-[2rem] object-cover object-top"
      />

      <div className="mt-4">
        <BarberScript
          name={cut.name}
          barber={cut.barber}
          type={HAIR_TYPES.includes(payload.t as HairType) ? (payload.t as HairType) : undefined}
        />
      </div>

      <dl className="card mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted">Top</dt>
        <dd className="font-medium">{cut.barber.top}</dd>
        <dt className="text-muted">Sides</dt>
        <dd className="font-medium">{cut.barber.sides}</dd>
        <dt className="text-muted">Notes</dt>
        <dd>{cut.barber.notes}</dd>
      </dl>
      <p className="mt-2 text-sm text-muted">{cardCopy.upkeep(cut.upkeep.trimWeeks)}</p>

      <section className="card mt-4" aria-labelledby="card-readings">
        <h2 id="card-readings" className="font-semibold">
          {cardCopy.readings}
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          {readings.map(([name, v]) => (
            <div key={name}>
              <dt className="text-sm text-muted">{name}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="mt-6 text-sm text-muted">{cardCopy.footer}</p>
    </main>
  );
}
