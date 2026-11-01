"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { readingsCopy } from "@/copy/screens";
import { cartCopy, kitCopy } from "@/copy/journey";
import { postJson } from "@/lib/client/api";
import { sessionState, useCart, useStoredProfile } from "@/lib/client/session-store";
import { KIT_STEPS, productById, type Kit } from "@/lib/kit/build";

// Keep it: kit grouped wash → style → finish with the reading behind
// each product, trim schedule, demo-store cart, and a signed barber-card link.

interface KitResponse {
  cut: { id: string; name: string; barber: { top: string; sides: string; notes: string }; referenceImage: string };
  kit: Kit;
}

type Load = { s: "loading" } | { s: "error" } | { s: "done"; data: KitResponse; at: number };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function KitView() {
  const cutId = useSearchParams().get("cut") ?? "";
  const profile = useStoredProfile();
  const cart = useCart();
  const [load, setLoad] = useState<Load>({ s: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (!profile || !cutId) return;
    const controller = new AbortController();
    postJson<KitResponse>("/api/kit", { cutId, profile }, controller.signal).then((r) => {
      if (!controller.signal.aborted) setLoad(r.ok ? { s: "done", data: r.data, at: Date.now() } : { s: "error" });
    });
    return () => controller.abort();
  }, [profile, cutId, attempt]);

  if (!cutId) return <Back text={kitCopy.noCut} />;
  if (profile === undefined) return <p className="text-muted">…</p>;
  if (profile === null) return <Back text={readingsCopy.missing} />;
  if (load.s === "loading") return <p className="text-muted" aria-live="polite">{kitCopy.loading}</p>;
  if (load.s === "error") {
    return (
      <div className="card flex flex-col gap-3" role="alert">
        <p>{kitCopy.error}</p>
        <button type="button" className="btn-secondary" onClick={() => (setLoad({ s: "loading" }), setAttempt((n) => n + 1))}>
          {kitCopy.retry}
        </button>
      </div>
    );
  }

  const { cut, kit } = load.data;
  const typeName = profile.type.status === "ok" ? readingsCopy.values.type[profile.type.value].toLowerCase() : "";
  const inCart = kit.items.every((i) => cart.includes(i.product.id));
  const nextTrim = new Date(load.at + kit.trimWeeks * 7 * 86400_000).toLocaleDateString("en-IN", { day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">{cut.name}</h2>

      {kit.typeUnknown && <p className="card text-sm">{kitCopy.typeUnknown}</p>}
      {KIT_STEPS.map((step) => {
        const items = kit.items.filter((i) => i.product.step === step);
        if (items.length === 0) return null;
        return (
          <section key={step} aria-labelledby={`kit-${step}`} className="flex flex-col gap-2">
            <h3 id={`kit-${step}`} className="text-sm font-semibold uppercase tracking-wide text-muted">
              {kitCopy.steps[step]}
            </h3>
            {items.map(({ product, reason }) => (
              <div key={product.id} className="card flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- static drawing */}
                <img src={product.image} alt="" className="size-12 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">
                    {product.name} <span className="text-sm font-normal text-muted">· {product.brand}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {reason.kind === "type" ? kitCopy.forType(typeName) : kitCopy.forConcern[reason.concern]}
                  </p>
                </div>
                <p className="font-medium">{inr(product.priceInr)}</p>
              </div>
            ))}
          </section>
        );
      })}

      <section className="card flex flex-col gap-1 text-sm">
        {kit.growthWeeks && <p>{kitCopy.grow(kit.growthWeeks)}</p>}
        <p>{kitCopy.trim(kit.trimWeeks)}</p>
        {!kit.growthWeeks && <p>{kitCopy.nextTrim(nextTrim)}</p>}
        <p>{kitCopy.daily(kit.dailyMinutes)}</p>
      </section>

      <button
        type="button"
        className="btn-primary"
        disabled={kit.items.length === 0}
        onClick={() => {
          sessionState.setCart([...cart, ...kit.items.map((i) => i.product.id)]);
          setCartOpen(true);
        }}
      >
        {inCart ? kitCopy.added : `${kitCopy.addToCart} · ${inr(kit.totalInr)}`}
      </button>
      {cart.length > 0 && (
        <button type="button" className="btn-secondary" onClick={() => setCartOpen(true)}>
          {cartCopy.open(cart.length)}
        </button>
      )}

      <BarberSection cut={cut} />
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  );
}

function BarberSection({ cut }: { cut: KitResponse["cut"] }) {
  const profile = useStoredProfile();
  const [link, setLink] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "making" | "error">("idle");
  const [copied, setCopied] = useState(false);

  async function make() {
    if (!profile) return;
    setState("making");
    const r = await postJson<{ path: string }>("/api/card", { cutId: cut.id, profile });
    if (r.ok) {
      setLink(new URL(r.data.path, window.location.origin).toString());
      setState("idle");
    } else setState("error");
  }

  return (
    <section aria-labelledby="barber" className="card flex flex-col gap-3">
      <h3 id="barber" className="font-semibold">
        {kitCopy.barberTitle}
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">{kitCopy.barberTop}</dt>
        <dd>{cut.barber.top}</dd>
        <dt className="text-muted">{kitCopy.barberSides}</dt>
        <dd>{cut.barber.sides}</dd>
        <dt className="text-muted">{kitCopy.barberNotes}</dt>
        <dd>{cut.barber.notes}</dd>
      </dl>
      {link ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{kitCopy.cardReady}</p>
          <a href={link} className="break-all text-sm text-accent underline">
            {link}
          </a>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true), () => {})}
            >
              {copied ? kitCopy.copied : kitCopy.copy}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void navigator.share?.({ title: cut.name, url: link }).catch(() => {})}
            >
              {kitCopy.share}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary" onClick={make} disabled={state === "making"}>
          {state === "making" ? kitCopy.making : kitCopy.makeCard}
        </button>
      )}
      {state === "error" && <p className="text-sm text-no">{kitCopy.error}</p>}
    </section>
  );
}

function CartDrawer({ onClose }: { onClose: () => void }) {
  const cart = useCart();
  const [summary, setSummary] = useState(false);
  // Prices come from the catalogue, never from storage.
  const lines = cart.map(productById).filter((p) => p !== undefined);
  const total = lines.reduce((n, p) => n + p.priceInr, 0);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cart-title" data-lenis-prevent className="fixed inset-0 z-10 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-background p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 id="cart-title" className="text-lg font-semibold">
            {summary ? cartCopy.summaryTitle : cartCopy.title}
          </h2>
          <button type="button" className="btn-secondary min-h-10 px-3" onClick={onClose}>
            {cartCopy.close}
          </button>
        </div>
        <p className="mt-2 rounded-lg bg-warn-bg px-3 py-1 text-sm text-warn">{cartCopy.banner}</p>
        {lines.length === 0 ? (
          <p className="mt-4 text-muted">{cartCopy.empty}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {lines.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span>{p.name}</span>
                <span className="flex items-center gap-3">
                  {inr(p.priceInr)}
                  {!summary && (
                    <button
                      type="button"
                      className="text-sm text-muted underline"
                      aria-label={cartCopy.remove(p.name)}
                      onClick={() => sessionState.setCart(cart.filter((id) => id !== p.id))}
                    >
                      ✕
                    </button>
                  )}
                </span>
              </li>
            ))}
            <li className="mt-2 flex justify-between border-t border-line pt-2 font-semibold">
              <span>{cartCopy.total}</span>
              <span>{inr(total)}</span>
            </li>
          </ul>
        )}
        {summary ? (
          <p className="mt-4 text-sm">{cartCopy.summaryNote}</p>
        ) : (
          lines.length > 0 && (
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => setSummary(true)}>
              {cartCopy.checkout}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Back({ text }: { text: string }) {
  return (
    <div className="card flex flex-col gap-3">
      <p>{text}</p>
      <Link href="/verdict" className="btn-secondary">
        {readingsCopy.seeVerdicts}
      </Link>
    </div>
  );
}
