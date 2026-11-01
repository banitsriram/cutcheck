import "server-only";

// The seam for image-producing steps: hair try-on, and the Look's clothes and shoes.
// YouCam implements it for real; the mock serves labelled illustrations for dev and tests.

/** Where a result image lives. Remote URLs are vendor-signed and never leave the server. */
export type ResultImage = { kind: "remote"; url: string } | { kind: "local"; path: string };

export interface StudioResult {
  image: ResultImage | null;
  taskId: string | null;
  unitsCharged: number;
  failure?: "photo" | "service";
}

/** The shoes step starts from the clothes result if there is one, else from the body photo. */
export type ShoesSource = { kind: "file"; fileRef: string } | { kind: "image"; image: ResultImage };

export interface LookStudio {
  readonly source: "youcam" | "mock";
  /** Units to reserve per step (each succeeding). */
  readonly units: { hair: number; clothes: number; shoes: number };
  hair(fileRef: string, templateId: string, signal?: AbortSignal): Promise<StudioResult>;
  /** Uploads the full-body photo (free); returns its file ref. */
  uploadBody(image: Buffer, signal?: AbortSignal): Promise<string>;
  clothes(bodyRef: string, templateId: string, signal?: AbortSignal): Promise<StudioResult>;
  shoes(source: ShoesSource, shoe: Buffer, signal?: AbortSignal): Promise<StudioResult>;
}
