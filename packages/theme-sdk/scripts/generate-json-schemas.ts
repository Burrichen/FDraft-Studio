/**
 * Generates canonical JSON Schema files from this package's Zod schemas
 * (the source of truth — see `schemas/README.md`) into the repo-root
 * `schemas/` directory. Run with `--check` in CI to fail on drift instead
 * of writing.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { StudioProjectDocumentSchema } from "../src/schema/project.js";
import { RuntimeThemeDocumentSchema, RuntimeThemeManifestSchema } from "../src/schema/theme.js";
import { StudioPackageManifestSchema } from "../src/packaging/fdstudio.js";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const schemasDir = join(packageRoot, "..", "..", "schemas");

const TARGETS: { fileName: string; schema: z.ZodType }[] = [
  { fileName: "studio-project.schema.json", schema: StudioProjectDocumentSchema },
  { fileName: "runtime-theme.schema.json", schema: RuntimeThemeDocumentSchema },
  { fileName: "fdstudio-manifest.schema.json", schema: StudioPackageManifestSchema },
  { fileName: "fdtheme-manifest.schema.json", schema: RuntimeThemeManifestSchema },
];

function render(schema: z.ZodType): string {
  return JSON.stringify(z.toJSONSchema(schema), null, 2) + "\n";
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  await mkdir(schemasDir, { recursive: true });

  const drift: string[] = [];
  for (const { fileName, schema } of TARGETS) {
    const rendered = render(schema);
    const filePath = join(schemasDir, fileName);
    if (check) {
      let existing: string | undefined;
      try {
        existing = await readFile(filePath, "utf8");
      } catch {
        existing = undefined;
      }
      if (existing !== rendered) drift.push(fileName);
    } else {
      await writeFile(filePath, rendered);
    }
  }

  if (check) {
    if (drift.length > 0) {
      console.error(`Schema drift detected in: ${drift.join(", ")}`);
      console.error('Run "pnpm generate:schemas" and commit the result.');
      process.exitCode = 1;
      return;
    }
    console.log("schemas/*.schema.json match the current Zod schemas.");
    return;
  }

  console.log(`Wrote ${TARGETS.length} schema file(s) to ${dirname(join(schemasDir, "x"))}`);
}

main();
