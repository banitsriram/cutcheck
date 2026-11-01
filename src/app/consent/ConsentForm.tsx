"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { consentCopy } from "@/copy/screens";
import { sessionState } from "@/lib/client/session-store";

export function ConsentForm() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!agreed) return;
        sessionState.giveConsent();
        router.push("/scan");
      }}
    >
      <label className="flex min-h-12 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-[var(--accent)]"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>{consentCopy.checkbox}</span>
      </label>
      <button type="submit" className="btn-primary" disabled={!agreed}>
        {consentCopy.continue}
      </button>
      <Link href="/privacy" className="text-center text-sm text-muted underline">
        {consentCopy.privacyLink}
      </Link>
    </form>
  );
}
