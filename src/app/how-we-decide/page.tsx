import { Screen } from "@/components/Screen";
import { howWeDecideCopy as copy, readingsCopy } from "@/copy/screens";
import { CUTS } from "@/lib/verdict/rules";

export const metadata = { title: "How we decide | CutCheck" };

// "How we decide": the Cut Requirements Matrix rendered straight from data/cuts.json.
export default function HowWeDecidePage() {
  const v = readingsCopy.values;
  return (
    <Screen title={copy.title} intro={copy.intro} wide>
      <ol className="card flex list-decimal flex-col gap-2 pl-8">
        {copy.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>

      {/* Focusable so keyboard users can scroll the table on narrow screens (axe: scrollable-region-focusable). */}
      <div className="mt-6 overflow-x-auto rounded-3xl border border-line" role="region" aria-label={copy.title} tabIndex={0}>
        <table className="w-full min-w-[640px] border-collapse bg-surface text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              {copy.columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CUTS.map((cut) => (
              <tr key={cut.id} className="border-b border-line last:border-0">
                <th scope="row" className="px-3 py-2 font-medium">
                  {cut.name}
                </th>
                <td className="px-3 py-2">{cut.audience.map((a) => copy.audience[a]).join(", ")}</td>
                <td className="px-3 py-2">{cut.needs.types.map((t) => v.type[t]).join(", ")}</td>
                <td className="px-3 py-2">
                  {v.density[cut.needs.minDensity]}
                  {cut.needs.warnAtDensity && (
                    <span className="block text-xs text-muted">
                      {copy.productsAt} {v.density[cut.needs.warnAtDensity]}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{v.length[cut.needs.minLength]}</td>
                <td className="px-3 py-2">{cut.needs.maxFrizz ? v.frizz[cut.needs.maxFrizz] : copy.noFrizzLimit}</td>
                <td className="px-3 py-2">
                  {cut.upkeep.trimWeeks} {copy.weeks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted">{copy.source}</p>
    </Screen>
  );
}
