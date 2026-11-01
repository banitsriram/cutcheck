import { MockNotice } from "@/components/MockNotice";
import { Screen } from "@/components/Screen";
import { readingsCopy } from "@/copy/screens";
import { ReadingsBoard } from "./ReadingsBoard";

export const metadata = { title: "Your hair readings | CutCheck" };

export default function ReadingsPage() {
  return (
    <Screen step={1} title={readingsCopy.title} intro={readingsCopy.intro}>
      <MockNotice />
      <ReadingsBoard />
    </Screen>
  );
}
