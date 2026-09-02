#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { isSdkError } from "./errors.js";
import { validateProject } from "./validation/validateProject.js";
import { validateTheme } from "./validation/validateTheme.js";
import { packFdstudio, unpackFdstudio, StudioPackageManifestSchema } from "./packaging/fdstudio.js";
import { unpackFdtheme } from "./packaging/fdtheme.js";
import { compileTheme } from "./compile/compileTheme.js";
import { packFdtheme } from "./packaging/fdtheme.js";
import { inspectPackage } from "./inspect.js";
import { verifyManifestHashes } from "./packaging/verify.js";
import { readZipSafely } from "./packaging/zip.js";
import { readUnpackedProject, writeUnpackedProject, directoryExists } from "./packaging/nodeFs.js";
import { RuntimeThemeManifestSchema } from "./schema/theme.js";

const SDK_VERSION = "0.1.0";

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function fail(message: string, details?: unknown): never {
  console.error(`error: ${message}`);
  if (details !== undefined) console.error(JSON.stringify(details, null, 2));
  process.exitCode = 1;
  throw new Error(message);
}

async function cmdValidate(path: string): Promise<void> {
  if (await directoryExists(path)) {
    const { project, migrationsApplied } = await readUnpackedProject(path);
    printJson({ valid: true, migrationsApplied, projectId: project.metadata.id });
    return;
  }
  if (path.endsWith(".fdstudio")) {
    const { project, migrationsApplied } = await unpackFdstudio(new Uint8Array(await readFile(path)));
    printJson({ valid: true, migrationsApplied, projectId: project.metadata.id });
    return;
  }
  if (path.endsWith(".fdtheme")) {
    const { document } = await unpackFdtheme(new Uint8Array(await readFile(path)));
    printJson({ valid: true, themeId: document.manifest.themeId });
    return;
  }
  // Fall back to raw JSON: try project shape, then theme shape.
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  const projectResult = validateProject(raw);
  if (projectResult.valid) {
    printJson({ valid: true, kind: "project" });
    return;
  }
  const themeResult = validateTheme(raw);
  if (themeResult.valid) {
    printJson({ valid: true, kind: "theme" });
    return;
  }
  printJson({ valid: false, projectIssues: projectResult.issues, themeIssues: themeResult.issues });
  process.exitCode = 1;
}

async function cmdInspect(path: string): Promise<void> {
  const bytes = new Uint8Array(await readFile(path));
  printJson(inspectPackage(bytes));
}

async function cmdVerify(path: string): Promise<void> {
  const bytes = new Uint8Array(await readFile(path));
  const files = readZipSafely(bytes);
  const manifestBytes = files["manifest.json"];
  if (!manifestBytes) fail('archive is missing "manifest.json"');
  const raw: unknown = JSON.parse(new TextDecoder().decode(manifestBytes!));
  const packageFormat = (raw as { packageFormat?: unknown }).packageFormat;
  const manifest =
    packageFormat === "fdstudio"
      ? StudioPackageManifestSchema.parse(raw)
      : packageFormat === "fdtheme"
        ? RuntimeThemeManifestSchema.parse(raw)
        : fail(`unrecognised packageFormat "${String(packageFormat)}"`);
  const issues = await verifyManifestHashes(files, manifest.files, ["manifest.json"]);
  if (issues.length > 0) {
    printJson({ valid: false, issues });
    process.exitCode = 1;
    return;
  }
  printJson({ valid: true, filesVerified: manifest.files.length });
}

async function cmdPack(projectDir: string, outputPath: string): Promise<void> {
  const { project, assets, migrationsApplied } = await readUnpackedProject(projectDir);
  if (migrationsApplied.length > 0) {
    console.error(`note: migrated project from ${migrationsApplied[0]!.fromVersion} while reading (writing back at current version)`);
  }
  const bytes = await packFdstudio({ project, assets, sdkVersion: SDK_VERSION });
  await writeFile(outputPath, bytes);
  console.error(`wrote ${outputPath} (${bytes.byteLength} bytes)`);
}

async function cmdUnpack(inputPath: string, outputDir: string): Promise<void> {
  const { project, assets } = await unpackFdstudio(new Uint8Array(await readFile(inputPath)));
  await writeUnpackedProject(outputDir, { project, assets, sdkVersion: SDK_VERSION });
  console.error(`unpacked to ${outputDir}`);
}

async function cmdCompile(inputPath: string, outputPath: string, minRendererVersion: string): Promise<void> {
  const isDirectory = await directoryExists(inputPath);
  const { project, assets } = isDirectory
    ? await readUnpackedProject(inputPath)
    : await unpackFdstudio(new Uint8Array(await readFile(inputPath)));
  const bundle = compileTheme(project, assets, { minRendererVersion });
  const bytes = await packFdtheme(bundle);
  await writeFile(outputPath, bytes);
  console.error(`wrote ${outputPath} (${bytes.byteLength} bytes)`);
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { "min-renderer-version": { type: "string" } },
  });
  const [command, ...args] = positionals;

  switch (command) {
    case "validate":
      if (!args[0]) fail("usage: fdraft-theme validate <path>");
      await cmdValidate(args[0]!);
      return;
    case "inspect":
      if (!args[0]) fail("usage: fdraft-theme inspect <path>");
      await cmdInspect(args[0]!);
      return;
    case "verify":
      if (!args[0]) fail("usage: fdraft-theme verify <path.fdstudio|path.fdtheme>");
      await cmdVerify(args[0]!);
      return;
    case "pack":
      if (!args[0] || !args[1]) fail("usage: fdraft-theme pack <projectDir> <output.fdstudio>");
      await cmdPack(args[0]!, args[1]!);
      return;
    case "unpack":
      if (!args[0] || !args[1]) fail("usage: fdraft-theme unpack <input.fdstudio> <outputDir>");
      await cmdUnpack(args[0]!, args[1]!);
      return;
    case "compile":
      if (!args[0] || !args[1]) fail("usage: fdraft-theme compile <input> <output.fdtheme> --min-renderer-version=<semver>");
      await cmdCompile(args[0]!, args[1]!, values["min-renderer-version"] ?? "0.1.0");
      return;
    default:
      console.error(
        [
          "fdraft-theme — @fdraft/theme-sdk CLI",
          "",
          "commands:",
          "  validate <path>                                  validate a project/theme (file, .fdstudio/.fdtheme, or unpacked dir)",
          "  inspect <path.fdstudio|path.fdtheme>             print manifest metadata",
          "  verify <path.fdstudio|path.fdtheme>              verify every manifest file hash",
          "  pack <projectDir> <output.fdstudio>              pack an unpacked project directory",
          "  unpack <input.fdstudio> <outputDir>              unpack to a directory",
          "  compile <input> <output.fdtheme> [--min-renderer-version=x.y.z]   compile to a runtime theme",
        ].join("\n"),
      );
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((error) => {
  if (isSdkError(error)) {
    console.error(`error [${error.code}]: ${error.message}`);
    if (error.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
  } else {
    console.error(error);
  }
  process.exitCode = process.exitCode ?? 1;
});
