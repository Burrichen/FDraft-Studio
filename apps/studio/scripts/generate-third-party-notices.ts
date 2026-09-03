/**
 * Generates `apps/studio/THIRD_PARTY_NOTICES.md` from real dependency
 * metadata — never a hand-maintained list, which would silently rot the
 * moment a dependency changed.
 *
 * The Windows installer redistributes compiled forms of both dependency
 * trees, and the permissive licences they use (MIT/Apache-2.0/BSD/ISC/…)
 * require their copyright notices to travel with that redistribution. This
 * script is the mechanism that makes that possible honestly:
 *
 * - **npm side**: `pnpm licenses list --prod --json`, which resolves the real
 *   production graph from the committed lockfile (dev dependencies are
 *   excluded because they are not shipped).
 * - **Rust side**: `cargo metadata`, filtered to the crates actually in the
 *   resolved dependency graph for the Tauri binary — not the whole registry,
 *   and not just the direct dependencies.
 *
 * Full licence texts are included once per distinct licence, rather than
 * repeated per package: hundreds of crates share a handful of licences, and a
 * file nobody can read is worse documentation than a file that is accurate.
 * Where a package ships its own LICENSE file, its text is preferred over a
 * generic template so real copyright lines are preserved verbatim.
 *
 * Run: pnpm --filter @fdraft/studio exec tsx scripts/generate-third-party-notices.ts
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const STUDIO_ROOT = join(import.meta.dirname, "..");
const WORKSPACE_ROOT = join(STUDIO_ROOT, "..", "..");
const OUTPUT = join(STUDIO_ROOT, "THIRD_PARTY_NOTICES.md");

/** Workspace-internal packages: our own code, covered by the root LICENSE, not third party. */
const OWN_PACKAGES = new Set(["@fdraft/theme-sdk", "@fdraft/theme-renderer", "@fdraft/studio", "fdraft-studio"]);

interface Dep {
  name: string;
  version: string;
  license: string;
  /** Verbatim text of the package's own licence file, when it ships one. */
  licenseText?: string;
}

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** A package's own LICENSE/COPYING file text, so real copyright lines are preserved rather than genericised. */
function readLicenseFile(packageDir: string | undefined): string | undefined {
  if (!packageDir || !existsSync(packageDir)) return undefined;
  let entries: string[];
  try {
    entries = readdirSync(packageDir);
  } catch {
    return undefined;
  }
  const candidate = entries.find((entry) => /^(licen[cs]e|copying|notice)(\.(md|txt))?$/i.test(entry));
  if (!candidate) return undefined;
  try {
    const text = readFileSync(join(packageDir, candidate), "utf8").trim();
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}

function collectNpm(): Dep[] {
  const raw = run("pnpm", ["licenses", "list", "--prod", "--json"], WORKSPACE_ROOT);
  const byLicense = JSON.parse(raw) as Record<string, { name: string; versions: string[]; license: string; paths?: string[] }[]>;
  const deps: Dep[] = [];
  for (const packages of Object.values(byLicense)) {
    for (const pkg of packages) {
      if (OWN_PACKAGES.has(pkg.name)) continue;
      for (const version of pkg.versions) {
        deps.push({
          name: pkg.name,
          version,
          license: pkg.license,
          licenseText: readLicenseFile(pkg.paths?.[0]),
        });
      }
    }
  }
  return deps;
}

interface CargoPackage {
  id: string;
  name: string;
  version: string;
  license?: string | null;
  license_file?: string | null;
  manifest_path: string;
}

/**
 * The only platform Studio ships. Without `--filter-platform`, `cargo
 * metadata` returns the union of every target's optional dependencies — so
 * generating on macOS listed 22 macOS-only crates (`core-foundation`, `objc2`,
 * …) that are not in the Windows installer at all, while a notices file's
 * whole job is to describe what actually ships.
 */
const WINDOWS_TARGET = "x86_64-pc-windows-msvc";

function collectCargo(): Dep[] {
  const raw = run("cargo", ["metadata", "--format-version", "1", "--filter-platform", WINDOWS_TARGET], join(STUDIO_ROOT, "src-tauri"));
  const meta = JSON.parse(raw) as {
    packages: CargoPackage[];
    resolve?: { nodes: { id: string }[] } | null;
    workspace_members: string[];
  };
  // Only crates actually in the resolved graph, and never our own crate.
  const resolved = new Set((meta.resolve?.nodes ?? []).map((node) => node.id));
  const workspace = new Set(meta.workspace_members);
  const deps: Dep[] = [];
  for (const pkg of meta.packages) {
    if (workspace.has(pkg.id) || OWN_PACKAGES.has(pkg.name)) continue;
    if (resolved.size > 0 && !resolved.has(pkg.id)) continue;
    deps.push({
      name: pkg.name,
      version: pkg.version,
      license: pkg.license ?? (pkg.license_file ? `see ${pkg.license_file}` : "UNKNOWN"),
      licenseText: readLicenseFile(dirname(pkg.manifest_path)),
    });
  }
  return deps;
}

function dedupe(deps: Dep[]): Dep[] {
  const seen = new Map<string, Dep>();
  for (const dep of deps) {
    const key = `${dep.name}@${dep.version}`;
    const existing = seen.get(key);
    // Prefer the entry that actually carries licence text.
    if (!existing || (!existing.licenseText && dep.licenseText)) seen.set(key, dep);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/** One representative verbatim licence text per distinct licence expression, chosen from the packages using it. */
function representativeTexts(deps: Dep[]): Map<string, { text: string; from: string }> {
  const byLicense = new Map<string, { text: string; from: string }>();
  for (const dep of deps) {
    if (!dep.licenseText || byLicense.has(dep.license)) continue;
    // Skip texts that are just a pointer rather than a real licence.
    if (dep.licenseText.length < 120) continue;
    byLicense.set(dep.license, { text: dep.licenseText, from: `${dep.name}@${dep.version}` });
  }
  return byLicense;
}

function table(deps: Dep[]): string {
  const rows = deps.map((dep) => `| \`${dep.name}\` | ${dep.version} | ${dep.license} |`);
  return ["| Package | Version | Licence |", "| --- | --- | --- |", ...rows].join("\n");
}

function main(): void {
  const npm = dedupe(collectNpm());
  const cargo = dedupe(collectCargo());
  const all = [...npm, ...cargo];

  const unknown = all.filter((dep) => dep.license === "UNKNOWN" || dep.license.startsWith("see "));
  const licenceCounts = new Map<string, number>();
  for (const dep of all) licenceCounts.set(dep.license, (licenceCounts.get(dep.license) ?? 0) + 1);
  const summary = [...licenceCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([license, count]) => `| ${license} | ${count} |`);

  const texts = representativeTexts(all);

  const out = `# Third-party notices — FDraft Studio

FDraft Studio itself is MIT licensed (see the repository's \`LICENSE\`). The
Windows installer additionally redistributes compiled forms of the
dependencies listed below, whose own licences require their copyright notices
to accompany that redistribution.

**This file is generated — do not edit it by hand.** Regenerate with:

\`\`\`
pnpm --filter @fdraft/studio exec tsx scripts/generate-third-party-notices.ts
\`\`\`

Sources: \`pnpm licenses list --prod --json\` for the shipped JavaScript
dependency graph (development-only dependencies are excluded, because they are
not distributed) and \`cargo metadata\` for the crates in the resolved Rust
dependency graph of the Tauri binary, filtered to the only target Studio ships
(\`x86_64-pc-windows-msvc\`) so the list describes what is actually in the
Windows installer rather than the union of every platform. Workspace-internal packages
(\`@fdraft/theme-sdk\`, \`@fdraft/theme-renderer\`, \`@fdraft/studio\`,
\`fdraft-studio\`) are our own code and are covered by \`LICENSE\`, not listed
here.

## Summary

${all.length} third-party packages: ${npm.length} JavaScript, ${cargo.length} Rust crates.

| Licence | Packages |
| --- | --- |
${summary.join("\n")}
${
  unknown.length > 0
    ? `\n> **${unknown.length} package(s) did not declare a machine-readable licence** and are listed below with whatever they do declare. These need a human check before any claim of full licence coverage:\n${unknown.map((dep) => `> - \`${dep.name}@${dep.version}\` — ${dep.license}`).join("\n")}\n`
    : "\n_Every listed package declares a machine-readable licence._\n"
}
## JavaScript dependencies (${npm.length})

${table(npm)}

## Rust crates (${cargo.length})

${table(cargo)}

## Licence texts

One verbatim text per distinct licence expression, taken from a package that
uses it (named for each). Packages sharing a licence share these terms; where a
package ships its own copyright line, it appears in the text below as that
package wrote it.

${
    [...texts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([license, { text, from }]) => `### ${license}\n\n_Text as shipped by \`${from}\`._\n\n\`\`\`text\n${text}\n\`\`\``)
      .join("\n\n")
  }
`;

  writeFileSync(OUTPUT, out, "utf8");
  console.log(`Wrote ${OUTPUT}`);
  console.log(`  ${npm.length} JavaScript packages, ${cargo.length} Rust crates, ${texts.size} distinct licence texts`);
  if (unknown.length > 0) console.log(`  ${unknown.length} package(s) without a machine-readable licence — flagged in the file`);
}

main();
