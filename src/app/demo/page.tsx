import { Screen } from "@/components/Screen";
import { demoCopy } from "@/copy/journey";
import { StartDemo } from "./StartDemo";

export const metadata = { title: "Demo | CutCheck" };

// Demo mode: loads the precomputed readings, then the live verdict engine takes over.
export default function DemoPage() {
  return (
    <Screen title={demoCopy.offer}>
      <StartDemo />
    </Screen>
  );
}
