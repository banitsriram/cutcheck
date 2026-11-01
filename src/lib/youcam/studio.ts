import "server-only";
import type { LookStudio, StudioResult } from "../studio/studio";
import { runImageTask, TASK_UNITS, uploadFile, type ImageTaskResult } from "./client";

// LookStudio on the YouCam API: hair try-on v2.1 keeping the user's colour,
// clothes from an outfit template, then Shoes V3 with our shoe photo as the reference.

const toResult = (r: ImageTaskResult): StudioResult => ({
  image: r.url ? { kind: "remote", url: r.url } : null,
  taskId: r.taskId,
  unitsCharged: r.unitsCharged,
  ...(r.failure ? { failure: r.failure } : {}),
});

export const youcamStudio: LookStudio = {
  source: "youcam",
  units: { hair: TASK_UNITS.hairTransfer, clothes: TASK_UNITS.clothes, shoes: TASK_UNITS.shoes },

  async hair(fileRef, templateId, signal) {
    // hair_color "src" keeps the user's own colour (v2.1).
    return toResult(await runImageTask("hairTransfer", { src_file_id: fileRef, template_id: templateId, hair_color: "src" }, signal));
  },

  uploadBody: (image, signal) => uploadFile(image, signal),

  async clothes(bodyRef, templateId, signal) {
    return toResult(await runImageTask("clothes", { src_file_id: bodyRef, template_id: templateId }, signal));
  },

  async shoes(source, shoe, signal) {
    let src: Record<string, string>;
    if (source.kind === "file") src = { src_file_id: source.fileRef };
    else if (source.image.kind === "remote") src = { src_file_url: source.image.url };
    // Mock images never reach this implementation; a local source means a misconfiguration.
    else return { image: null, taskId: null, unitsCharged: 0, failure: "service" };
    const ref = await uploadFile(shoe, signal);
    return toResult(await runImageTask("shoes", { ...src, ref_file_id: ref }, signal));
  },
};
