import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const required = [
  "CLAUDE.md",
  "docs/architecture/PRODUCT_CONTRACT.md",
  "docs/architecture/TWO_REPOSITORY_ARCHITECTURE.md",
  "docs/architecture/COMPATIBILITY_AND_RELEASES.md",
  "docs/architecture/INTEGRATION_WORKFLOW.md",
  "docs/IMPLEMENTATION_STATUS.md",
  "apps/studio/README.md",
  "packages/theme-sdk/README.md",
  "packages/theme-renderer/README.md",
];

const failures = [];
for (const relativePath of required) {
  try {
    await access(join(root, relativePath));
  } catch {
    failures.push(`Missing required file: ${relativePath}`);
  }
}

for (const relativePath of ["CLAUDE.md", "README.md"]) {
  const content = await readFile(join(root, relativePath), "utf8");
  if (!content.includes("FDraft-Studio")) {
    failures.push(`${relativePath} does not name the repository boundary`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("FDraft Studio architecture scaffold is present.");
}

