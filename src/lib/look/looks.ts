import { z } from "zod";
import looksJson from "../../../data/looks.json";

// Occasions for the Look step: a YouCam outfit template and our own shoe photo each.

const lookSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    outfit: z.string().min(1),
    clothTemplateId: z.string().min(1),
    shoeImage: z.string().regex(/^\/look\/[a-z0-9-]+\.jpg$/),
    style: z.enum(["masculine", "feminine"]),
  })
  .strict();

export type Look = z.infer<typeof lookSchema>;

export const LOOKS: readonly Look[] = z.array(lookSchema).min(1).parse(looksJson);
export const LOOK_IDS = LOOKS.map((l) => l.id) as [string, ...string[]];
