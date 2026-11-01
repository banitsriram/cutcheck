import Link from "next/link";
import { Screen } from "@/components/Screen";
import { notFoundCopy } from "@/copy/common";

export const metadata = { title: "Not found | CutCheck" };

export default function NotFound() {
  return (
    <Screen title={notFoundCopy.title} intro={notFoundCopy.intro}>
      <div className="flex flex-col gap-3">
        <Link href="/" className="btn-primary text-center">
          {notFoundCopy.home}
        </Link>
        <Link href="/demo" className="btn-secondary text-center">
          {notFoundCopy.demo}
        </Link>
      </div>
    </Screen>
  );
}
