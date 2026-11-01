import { Screen } from "@/components/Screen";
import { deleteCopy } from "@/copy/journey";
import { DeleteAll } from "./DeleteAll";

export const metadata = { title: "Delete my data | CutCheck" };

export default function DeletePage() {
  return (
    <Screen title={deleteCopy.title} intro={deleteCopy.intro}>
      <DeleteAll />
    </Screen>
  );
}
