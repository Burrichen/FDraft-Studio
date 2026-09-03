/**
 * Phase 4 proof: after importing real Christmas artwork into a Studio
 * project, deleting the *original* source PNGs must not break the
 * already-built `.fdstudio`/`.fdtheme` — `packFdstudio` embeds asset
 * bytes by content hash directly inside the package (see
 * `saveProject`/`packFdstudio` in `src/project/projectFile.ts`), so the
 * project should never need the original file to exist again.
 *
 * This never touches FDraft's real files: it copies the real
 * `public/events/christmas/` tree into a scratch directory, builds from
 * that copy, deletes the copy, then reopens the saved `.fdstudio` and
 * recompiles it — proving both steps succeed with the originals gone.
 *
 * Run: pnpm --filter @fdraft/studio exec tsx scripts/verify-delete-sources.ts <scratchDir>
 */
import { cp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createNodeTestPlatform } from "../test/helpers/nodePlatform.js";
import { openProjectFromPath } from "../src/project/projectFile.js";
import { compileProjectToFdtheme } from "@fdraft/theme-sdk/packaging";

const execFileAsync = promisify(execFile);

// Resolved relative to this script, per CLAUDE.md's documented sibling-checkout layout
// (`../FDraft` next to this repository) — never a machine-specific absolute path.
const STUDIO_ROOT = join(import.meta.dirname, "..");
const REAL_ASSET_DIR = join(import.meta.dirname, "../../../../FDraft/public/events/christmas");

async function main(): Promise<void> {
  const scratchDir = process.argv[2];
  if (!scratchDir) throw new Error("Usage: verify-delete-sources.ts <scratchDir>");

  const sourceCopyDir = join(scratchDir, "source-copy");
  const workDir = join(scratchDir, "build");
  await mkdir(sourceCopyDir, { recursive: true });
  await mkdir(workDir, { recursive: true });

  console.log(`Copying real assets ${REAL_ASSET_DIR} -> ${sourceCopyDir} (read-only copy, originals untouched)...`);
  await cp(REAL_ASSET_DIR, sourceCopyDir, { recursive: true });

  console.log("Building Christmas from the scratch copy (no publish — this is an isolated proof, not a re-publish)...");
  await execFileAsync("node_modules/.bin/tsx", ["scripts/build-christmas.ts", workDir, "", sourceCopyDir], {
    cwd: STUDIO_ROOT,
  });

  const fdstudioPath = join(workDir, "christmas.fdstudio");
  console.log(`Built ${fdstudioPath}. Deleting the scratch source copy entirely...`);
  await rm(sourceCopyDir, { recursive: true, force: true });

  console.log("Reopening the saved .fdstudio now that the original source PNGs are gone...");
  const reopenPlatform = createNodeTestPlatform({ appDataDir: join(scratchDir, "reopen", "appdata"), appConfigDir: join(scratchDir, "reopen", "appconfig") });
  const opened = await openProjectFromPath(reopenPlatform, fdstudioPath);

  console.log(`Reopened OK: ${opened.project.assets.length} asset record(s), ${Object.keys(opened.assets).length} byte blob(s) present in the package.`);
  if (opened.project.assets.length !== Object.keys(opened.assets).length) {
    throw new Error("Asset record count doesn't match embedded byte blob count after reopen.");
  }

  const recompiled = await compileProjectToFdtheme(opened.project, opened.assets, { minRendererVersion: "0.1.0" });
  console.log(`Recompiled .fdtheme from the reopened project: ${recompiled.byteLength} bytes. Delete-original-sources proof PASSED.`);
}

main().catch((error) => {
  console.error("Delete-original-sources proof FAILED:", error);
  process.exitCode = 1;
});
