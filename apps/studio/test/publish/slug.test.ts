import { describe, expect, it } from "vitest";
import { slugify, isPathSafeSlug } from "../../src/publish/slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates a normal title", () => {
    expect(slugify("Halloween Watch Party")).toBe("halloween-watch-party");
  });

  it("collapses non-alphanumeric runs into a single hyphen and trims edges", () => {
    expect(slugify("  --Cool Event 2!!--  ")).toBe("cool-event-2");
  });

  it("neutralizes path-traversal characters entirely", () => {
    expect(slugify("../../etc/passwd")).not.toContain("..");
    expect(slugify("../../etc/passwd")).not.toMatch(/[/\\]/);
  });

  it("falls back to a stable placeholder for an all-symbol name", () => {
    expect(slugify("!!!")).toBe("untitled");
  });
});

describe("isPathSafeSlug", () => {
  it("accepts a well-formed slug", () => {
    expect(isPathSafeSlug("halloween-watch-party")).toBe(true);
    expect(isPathSafeSlug("untitled")).toBe(true);
  });

  it("rejects anything containing a path separator or traversal segment", () => {
    expect(isPathSafeSlug("../etc")).toBe(false);
    expect(isPathSafeSlug("a/b")).toBe(false);
    expect(isPathSafeSlug("a\\b")).toBe(false);
    expect(isPathSafeSlug("")).toBe(false);
  });

  it("rejects a leading/trailing hyphen or uppercase letters, which slugify never produces", () => {
    expect(isPathSafeSlug("-leading")).toBe(false);
    expect(isPathSafeSlug("Trailing-")).toBe(false);
  });

  it("accepts every output slugify can actually produce (round trip)", () => {
    for (const name of ["Halloween Watch Party", "  --Cool Event 2!!--  ", "../../etc/passwd", "!!!", "Café Théâtre"]) {
      expect(isPathSafeSlug(slugify(name)), name).toBe(true);
    }
  });
});
