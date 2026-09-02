import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";
import { unpackFdtheme } from "@fdraft/theme-sdk/packaging";
import { readUnpackedProject } from "@fdraft/theme-sdk/node";
import type { FixtureAssetMap, FixtureScenario } from "../fixtures/types.js";

export const FIXTURES_VIRTUAL_MODULE_ID = "virtual:fdraft-fixtures";
const RESOLVED_ID = "\0" + FIXTURES_VIRTUAL_MODULE_ID;

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function guessMimeType(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

function assetsToDataUrls(assets: Record<string, Uint8Array>): FixtureAssetMap {
  const map: FixtureAssetMap = {};
  for (const [path, bytes] of Object.entries(assets)) {
    map[path] = `data:${guessMimeType(path)};base64,${Buffer.from(bytes).toString("base64")}`;
  }
  return map;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

/**
 * The one genuinely Node-only step in loading fixtures — reading the
 * unpacked project directory via `@fdraft/theme-sdk/node` (real
 * `node:fs`) — happens here, once, at dev-server-start/build time, never
 * in the browser bundle. (`@fdraft/theme-sdk/packaging`'s ZIP/hash code is
 * actually browser-safe now — Web Crypto, not `node:crypto` — but doing
 * the extraction here regardless keeps fixture loading in one place and
 * lets the browser bundle skip shipping any of it.) The browser only ever
 * receives plain, already-extracted JSON plus base64 asset data: URLs,
 * and runs the SDK's pure `validateProject`/`validateTheme`/
 * `migrateProject` itself, live, as a real client-side compatibility
 * preflight.
 */
export function fdraftFixturesPlugin(fixturesRoot: string): Plugin {
  return {
    name: "fdraft-fixtures",
    resolveId(id) {
      if (id === FIXTURES_VIRTUAL_MODULE_ID) return RESOLVED_ID;
      return undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;

      const scenarios: FixtureScenario[] = [];

      const sampleProject = await readUnpackedProject(join(fixturesRoot, "projects/sample-event"));
      scenarios.push({
        id: "sample-event-project",
        label: "Sample event — uncompiled project",
        description: "The hand-authored .fdstudio-equivalent project, rendered directly (no compile step) — proves Studio's own preview needs no separate implementation.",
        kind: "project",
        raw: sampleProject.project,
        assets: assetsToDataUrls(sampleProject.assets),
      });

      const fdthemeBytes = await readFile(join(fixturesRoot, "projects/sample-event.fdtheme"));
      const { document: fdthemeDocument } = await unpackFdtheme(new Uint8Array(fdthemeBytes));
      const themeAssetBytes: Record<string, Uint8Array> = {};
      for (const record of fdthemeDocument.assets) {
        // The renderer only ever needs bytes for assets the theme itself
        // declares — re-derive them from the already-hash-verified project
        // fixture rather than re-reading the archive per file.
        themeAssetBytes[record.path] = sampleProject.assets[record.path]!;
      }
      scenarios.push({
        id: "sample-event-fdtheme",
        label: "Sample event — compiled .fdtheme",
        description: "The real compiled, hash-verified .fdtheme binary fixture, unpacked exactly as FDraft would.",
        kind: "theme",
        raw: fdthemeDocument,
        assets: assetsToDataUrls(themeAssetBytes),
      });

      const invalidScenarios: { file: string; label: string; description: string }[] = [
        { file: "invalid/duplicate-ids.project.json", label: "Invalid — duplicate ids", description: "Two color tokens share the same id." },
        { file: "invalid/broken-reference.project.json", label: "Invalid — broken reference", description: "An image layer references an asset id that doesn't exist." },
        { file: "invalid/circular-master.project.json", label: "Invalid — circular master", description: "Two masters reference each other as their parent." },
        { file: "unsupported-version/future-major.project.json", label: "Unsupported — future major version", description: "Declares a project format version newer than this SDK supports." },
        { file: "unsupported-version/too-old-legacy.project.json", label: "Unsupported — too-old legacy version", description: "Declares a project format version older than the oldest migratable one." },
      ];
      for (const { file, label, description } of invalidScenarios) {
        scenarios.push({
          id: file,
          label,
          description,
          kind: "project",
          raw: await readJson(join(fixturesRoot, file)),
          assets: {},
        });
      }

      return `export const scenarios = ${JSON.stringify(scenarios)};`;
    },
  };
}
