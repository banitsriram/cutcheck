import { z } from "zod";
import productsJson from "../../../data/products.json";
import { HAIR_TYPES, type HairProfile, type HairType } from "../hair/types";
import type { Concern, Verdict } from "../verdict/engine";
import type { CutRule } from "../verdict/rules";

// Product kit: the cut's products for your hair type ∪ products for its ⚠ concerns,
// deduplicated, at most 4, ordered wash → style → finish. Pure; same input → same kit.

export const KIT_STEPS = ["wash", "style", "finish"] as const;
export type KitStep = (typeof KIT_STEPS)[number];

const productSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    brand: z.string().min(1),
    category: z.string().min(1),
    step: z.enum(KIT_STEPS),
    forTypes: z.array(z.enum(HAIR_TYPES)),
    forConcerns: z.array(z.enum(["frizz", "volume", "definition"])),
    priceInr: z.number().int().positive(),
    image: z.string().startsWith("/products/"),
  })
  .strict();

export type Product = z.infer<typeof productSchema>;

export const PRODUCTS: readonly Product[] = z
  .array(productSchema)
  .min(15)
  .max(25)
  .refine((ps) => new Set(ps.map((p) => p.id)).size === ps.length, { message: "duplicate product id" })
  .parse(productsJson);

const byId = new Map(PRODUCTS.map((p) => [p.id, p]));
export const productById = (id: string) => byId.get(id);

/** Product added for each ⚠ concern a cut raises (growth needs time, not a product). */
const CONCERN_PRODUCT: Partial<Record<Concern, string>> = {
  frizz: "anti-frizz-serum",
  volume: "volume-mousse",
};

export const MAX_KIT_ITEMS = 4;

export type KitReason = { kind: "type"; type: HairType } | { kind: "concern"; concern: "frizz" | "volume" };

export interface KitItem {
  product: Product;
  reason: KitReason;
}

export interface Kit {
  items: KitItem[];
  totalInr: number;
  trimWeeks: number;
  dailyMinutes: number;
  growthWeeks?: number;
  /** Hair type couldn't be read, so only concern products are included. */
  typeUnknown: boolean;
}

export function buildKit(cut: CutRule, verdict: Verdict, profile: HairProfile): Kit {
  const type = profile.type.status === "ok" ? profile.type.value : null;
  const base: KitItem[] = (type ? cut.productsByType[type] : []).flatMap((id) => {
    const product = byId.get(id);
    return product ? [{ product, reason: { kind: "type", type } as KitReason }] : [];
  });
  const concerns: KitItem[] = verdict.concerns.flatMap((c) => {
    const product = CONCERN_PRODUCT[c] ? byId.get(CONCERN_PRODUCT[c]) : undefined;
    return product && (c === "frizz" || c === "volume") ? [{ product, reason: { kind: "concern", concern: c } as KitReason }] : [];
  });

  // Keep the wash product and every concern product; fill the rest from the type list.
  const seen = new Set<string>();
  const pick = (items: KitItem[]) => items.filter((i) => !seen.has(i.product.id) && seen.add(i.product.id));
  const [wash, ...restBase] = base;
  const chosen = [...pick(wash ? [wash] : []), ...pick(concerns), ...pick(restBase)].slice(0, MAX_KIT_ITEMS);
  chosen.sort((a, b) => KIT_STEPS.indexOf(a.product.step) - KIT_STEPS.indexOf(b.product.step));

  return {
    items: chosen,
    totalInr: chosen.reduce((n, i) => n + i.product.priceInr, 0),
    trimWeeks: cut.upkeep.trimWeeks,
    dailyMinutes: cut.upkeep.dailyMinutes,
    ...(verdict.growthWeeks ? { growthWeeks: verdict.growthWeeks } : {}),
    typeUnknown: type === null,
  };
}
