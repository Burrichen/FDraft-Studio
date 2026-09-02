/**
 * `@fdraft/theme-sdk/packaging` — everything about `.fdstudio`/`.fdtheme`
 * archive bytes: pack, unpack, inspect, verify, hash, and the ZIP/security
 * primitives underneath them.
 *
 * This used to be Node-only (sha256 via `node:crypto`) — hashing now uses
 * the standard Web Crypto `crypto.subtle` API instead (see
 * `packaging/hash.ts`), which is why every function here is `async`. That
 * makes this whole module genuinely usable from a browser/webview bundle
 * too (e.g. Studio's Tauri frontend packing/unpacking `.fdstudio` files
 * directly) — it's still a separate entry point from the main
 * `@fdraft/theme-sdk` for conceptual separation (data model/validation vs.
 * archive format), not because it's unsafe to import from a browser.
 *
 * (For the genuinely Node-only *filesystem* helpers — reading/writing an
 * unpacked project directory via `node:fs` — see `@fdraft/theme-sdk/node`
 * instead. A browser/webview host reimplements that directory walk against
 * its own fs API — e.g. Tauri's `@tauri-apps/plugin-fs` — and hands the
 * resulting `Record<path, bytes>` to `buildFdstudioFileSet`/
 * `finalizeFdstudioFileSet` from this module.)
 */
import { packFdtheme } from "./packaging/fdtheme.js";
import { compileTheme, type CompileThemeOptions } from "./compile/compileTheme.js";
import type { StudioProjectDocument } from "./schema/project.js";

export { packFdstudio, unpackFdstudio, buildFdstudioFileSet, finalizeFdstudioFileSet } from "./packaging/fdstudio.js";
export type { FdstudioPackInput, FdstudioFileSet, FdstudioUnpackResult, StudioPackageManifest } from "./packaging/fdstudio.js";

export { packFdtheme };
export { unpackFdtheme } from "./packaging/fdtheme.js";
export type { FdthemeUnpackResult } from "./packaging/fdtheme.js";

export { inspectPackage } from "./inspect.js";
export type { StudioPackageInspection, ThemePackageInspection, PackageInspection } from "./inspect.js";

export { sha256Hex } from "./packaging/hash.js";
export { computeAssetPath } from "./packaging/assetPaths.js";
export { verifyManifestHashes, assertManifestHashesValid, type HashVerificationIssue } from "./packaging/verify.js";
export { createDeterministicZip, readZipSafely } from "./packaging/zip.js";
export * from "./packaging/security.js";

/** Convenience: compile a validated project straight to `.fdtheme` archive bytes in one call. */
export async function compileProjectToFdtheme(
  project: StudioProjectDocument,
  projectAssets: Record<string, Uint8Array>,
  options: CompileThemeOptions,
): Promise<Uint8Array> {
  return packFdtheme(compileTheme(project, projectAssets, options));
}
