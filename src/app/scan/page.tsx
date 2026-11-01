import { Screen } from "@/components/Screen";
import { captureCopy } from "@/copy/screens";
import { CaptureFlow } from "./CaptureFlow";

export const metadata = { title: "Scan your hair | CutCheck" };

export default function ScanPage() {
  return (
    <Screen step={0} title={captureCopy.title} intro={captureCopy.intro}>
      <CaptureFlow />
    </Screen>
  );
}
