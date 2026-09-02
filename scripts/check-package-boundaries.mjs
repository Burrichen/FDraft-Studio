import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * Forbidden import-string substrings per source directory, enforcing the
 * repository boundaries CLAUDE.md and the architecture docs describe:
 * theme-sdk/theme-renderer stay framework-neutral / host-agnostic, and
 * nothing in this repo ever reaches into the sibling FDraft checkout or
 * imports the not-yet-built Studio app.
 */
const RULES = [
  {
    dir: "packages/theme-sdk/src",
    forbidden: ["react", "react-dom", "@tauri-apps", "apps/studio", "FDraft/", "../FDraft"],
    reason: "@fdraft/theme-sdk must stay framework-neutral: no React, no Tauri, no DOM, no Studio/FDraft coupling",
  },
  {
    dir: "packages/theme-renderer/src",
    forbidden: ["@tauri-apps", "apps/studio", "FDraft/", "../FDraft", "next/"],
    reason: "@fdraft/theme-renderer must stay host-agnostic: no Tauri, no Studio app coupling, no FDraft (Next.js) coupling",
  },
  {
    dir: "apps/renderer-lab/src",
    forbidden: ["apps/studio", "FDraft/", "../FDraft"],
    reason: "the fixture lab proves the renderer independently — it must not depend on Studio or FDraft",
  },
  {
    dir: "apps/studio/src",
    forbidden: ["FDraft/", "../FDraft", "next/"],
    reason: "Studio has no source dependency on the sibling FDraft application",
  },
  {
    dir: "apps/studio/src-tauri/src",
    extensions: [".rs"],
    forbidden: ["../FDraft", "../../FDraft"],
    reason: "Studio's Rust backend has no source dependency on the sibling FDraft application",
  },
];

const DEFAULT_EXTENSIONS = [".ts", ".tsx"];

async function listFiles(dir, extensions) {
  const allowed = new Set(extensions);
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full, extensions)));
    else if (allowed.has(extname(entry.name))) out.push(full);
  }
  return out;
}

const failures = [];

for (const rule of RULES) {
  const dirPath = join(root, rule.dir);
  const files = await listFiles(dirPath, rule.extensions ?? DEFAULT_EXTENSIONS);
  const isRust = (rule.extensions ?? []).includes(".rs");
  for (const file of files) {
    const content = await readFile(file, "utf8");
    // Rust has no single import-statement syntax to filter down to like JS
    // does — scan every line for a Rust rule, only import/export lines otherwise.
    const relevantLines = isRust ? content.split("\n") : content.split("\n").filter((line) => /^\s*import\b|^\s*export\s+\*?\s*(\{[^}]*\})?\s*from\b/.test(line));
    for (const line of relevantLines) {
      for (const term of rule.forbidden) {
        if (line.includes(term)) {
          failures.push(`${file.replace(root, ".")}: forbidden import term "${term}" (${rule.reason})\n  ${line.trim()}`);
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Package boundary check failed (${failures.length} violation(s)):\n`);
  console.error(failures.join("\n\n"));
  process.exitCode = 1;
} else {
  console.log("Package boundary check passed: no forbidden cross-boundary imports found.");
}
