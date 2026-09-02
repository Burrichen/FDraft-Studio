import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const cliEntry = join(packageRoot, "src/cli.ts");
const sampleFixtureDir = fileURLToPath(new URL("../../../../fixtures/projects/sample-event", import.meta.url));

function runCli(args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync("npx", ["tsx", cliEntry, ...args], { cwd: packageRoot, encoding: "utf8" });
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", status: result.status ?? 1 };
}

describe("fdraft-theme CLI", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "fdraft-theme-cli-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("prints usage with no arguments", () => {
    const result = runCli([]);
    expect(result.stderr).toContain("fdraft-theme");
    expect(result.status).toBe(0);
  }, 15_000);

  it("validates the committed sample-event fixture directory", () => {
    const result = runCli(["validate", sampleFixtureDir]);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.valid).toBe(true);
  }, 15_000);

  it("packs the fixture directory, then inspects, verifies, unpacks, and compiles it", () => {
    const fdstudioPath = join(workDir, "sample-event.fdstudio");
    const pack = runCli(["pack", sampleFixtureDir, fdstudioPath]);
    expect(pack.status).toBe(0);

    const inspect = runCli(["inspect", fdstudioPath]);
    expect(inspect.status).toBe(0);
    const inspected = JSON.parse(inspect.stdout);
    expect(inspected.packageFormat).toBe("fdstudio");
    expect(inspected.manifest.files.length).toBeGreaterThan(0);

    const verify = runCli(["verify", fdstudioPath]);
    expect(verify.status).toBe(0);
    expect(JSON.parse(verify.stdout).valid).toBe(true);

    const unpackDir = join(workDir, "unpacked");
    const unpack = runCli(["unpack", fdstudioPath, unpackDir]);
    expect(unpack.status).toBe(0);

    const revalidate = runCli(["validate", unpackDir]);
    expect(revalidate.status).toBe(0);
    expect(JSON.parse(revalidate.stdout).valid).toBe(true);

    const fdthemePath = join(workDir, "sample-event.fdtheme");
    const compile = runCli(["compile", fdstudioPath, fdthemePath, "--min-renderer-version=0.1.0"]);
    expect(compile.status).toBe(0);

    const themeVerify = runCli(["verify", fdthemePath]);
    expect(themeVerify.status).toBe(0);
    expect(JSON.parse(themeVerify.stdout).valid).toBe(true);

    const themeInspect = runCli(["inspect", fdthemePath]);
    const themeInspected = JSON.parse(themeInspect.stdout);
    expect(themeInspected.packageFormat).toBe("fdtheme");
    expect(themeInspected.manifest.minRendererVersion).toBe("0.1.0");
  }, 60_000);

  it("reports a validation failure for an invalid project with a non-zero exit code", () => {
    const invalidPath = join(dirname(dirname(sampleFixtureDir)), "invalid", "broken-reference.project.json");
    const result = runCli(["validate", invalidPath]);
    expect(result.status).not.toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.valid).toBe(false);
  }, 15_000);
});
