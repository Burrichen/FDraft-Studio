import type { Id } from "./schema/primitives.js";

/**
 * Creates a new stable id for a referenceable object. Uses the standard
 * `crypto.randomUUID()` global (available in Node 19+ with no import, and
 * in every modern browser) rather than `node:crypto` — this module must
 * stay usable from a browser bundle (Studio's Tauri webview, the fixture
 * lab, FDraft's client code), unlike `packaging/hash.ts`'s sha256, which
 * is genuinely Node-only for now (see `packagingIndex.ts`).
 */
export function createId(): Id {
  return crypto.randomUUID();
}
