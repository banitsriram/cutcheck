import { z } from "zod";

// YouCam response shapes, written from observed responses (docs/API_NOTES.md, docs/api-samples/).
// Lenient on extra keys (the vendor adds fields between versions); strict on what we read.

export const fileCreateSchema = z.object({
  data: z.object({
    files: z
      .array(
        z.object({
          file_id: z.string().min(1),
          requests: z
            .array(
              z.object({
                url: z.url(),
                method: z.string().default("PUT"),
                headers: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
  }),
});

export const taskCreateSchema = z.object({ data: z.object({ task_id: z.string().min(1) }) });

export const taskStatusSchema = z.object({
  data: z.object({
    task_status: z.enum(["running", "success", "error"]),
    error: z.string().nullish(),
    results: z.unknown().nullish(),
  }),
});
export type TaskStatus = z.infer<typeof taskStatusSchema>["data"];

export const hairTypeResultSchema = z.object({
  hair_type: z.object({ mapping: z.string(), term: z.string().optional() }),
});
export const hairLengthResultSchema = z.object({ hair_length: z.object({ term: z.string() }) });
export const hairFrizzResultSchema = z.object({
  hair_frizziness: z.object({ mapping: z.coerce.number(), term: z.string().optional() }),
});
export const hairDensityResultSchema = z.object({
  hair_density: z.object({ term: z.string(), mapping: z.unknown().optional() }),
});
/** Hair try-on, clothes and shoes all return one signed result URL (observed for try-on; documented for the others). */
export const imageResultSchema = z.object({ url: z.url().startsWith("https://") });

/** Task errors that mean "the photo didn't show it" rather than "the service failed". */
export const PHOTO_ERRORS = new Set([
  "error_no_face",
  "error_pose",
  "error_face_parsing",
  "error_face_angle_invalid",
  "exceed_max_filesize",
  "error_decode_image",
]);
