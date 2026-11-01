import { MockNotice } from "@/components/MockNotice";
import { Screen } from "@/components/Screen";
import { verdictBoardCopy } from "@/copy/screens";
import { CUTS } from "@/lib/verdict/rules";
import { VerdictBoard, type CutSummary } from "./VerdictBoard";

export const metadata = { title: "Which cuts work | CutCheck" };

// Verdict board. Cut names come from the server; verdicts from /api/verdict.
export default function VerdictPage() {
  const cuts: CutSummary[] = CUTS.map((c) => ({
    id: c.id,
    name: c.name,
    blurb: c.blurb,
    trend2026: c.trend2026,
    photo: c.referenceImage,
    types: [...c.needs.types],
    trimWeeks: c.upkeep.trimWeeks,
    dailyMinutes: c.upkeep.dailyMinutes,
    barber: c.barber,
  }));
  return (
    <Screen step={1} title={verdictBoardCopy.title} intro={verdictBoardCopy.intro}>
      <MockNotice />
      <VerdictBoard cuts={cuts} />
    </Screen>
  );
}
