"use client";

// The front shot lives only in this module's memory: it survives client-side navigation
// between screens so it can be re-sent if the server's file reference expired, and is gone
// on reload or tab close. Never written to any storage.

let selfie: Blob | null = null;

export const photoMemory = {
  get: () => selfie,
  set: (blob: Blob) => {
    selfie = blob;
  },
  clear: () => {
    selfie = null;
  },
};
