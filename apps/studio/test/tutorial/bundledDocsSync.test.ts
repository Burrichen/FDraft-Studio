// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `apps/studio/src/tutorial/content/*.md` are bundled OFFLINE copies of
 * the canonical `docs/guides/*.md` (the tutorial can never fetch or read
 * outside its own app bundle at runtime — see App.tsx's `?raw` imports).
 * This guards against silent drift: if the canonical docs change, this
 * test fails until the bundled copies are updated to match.
 */
const REPO_ROOT = join(import.meta.dirname, "../../../..");

describe("bundled tutorial doc content stays in sync with the canonical guides", () => {
  it.each([
    ["USER_GUIDE.md"],
    ["TROUBLESHOOTING.md"],
  ])("%s", (name) => {
    const canonical = readFileSync(join(REPO_ROOT, "docs/guides", name), "utf-8");
    const bundled = readFileSync(join(import.meta.dirname, "../../src/tutorial/content", name), "utf-8");
    expect(bundled).toBe(canonical);
  });
});
