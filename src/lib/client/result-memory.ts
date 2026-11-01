"use client";

// Result-image links from this page view (try-on per cut, last look), in memory only, like
// photoMemory, gone on reload. The links themselves expire on the server after 15 minutes.

const tryOns = new Map<string, string>();

export const resultMemory = {
  tryOn: (cutId: string) => tryOns.get(cutId) ?? null,
  setTryOn: (cutId: string, src: string) => void tryOns.set(cutId, src),
  clear: () => tryOns.clear(),
};
