// @vitest-environment node
import { describe, expect, it } from "vitest";
import { dedupeDisplayName, sanitizeDisplayFileName } from "../../src/assets/fileNames.js";

describe("sanitizeDisplayFileName", () => {
  it("leaves an ordinary name untouched", () => {
    expect(sanitizeDisplayFileName("Candy Bowl - Full.png")).toBe("Candy Bowl - Full.png");
  });

  it("keeps Unicode text and normalises decomposed input to NFC", () => {
    const decomposed = `Café.png`; // "e" + combining acute accent (NFD form)
    const precomposed = `Café.png`; // single precomposed character (NFC form)
    const result = sanitizeDisplayFileName(decomposed);
    expect(result).toBe(precomposed);
    expect(result.normalize("NFC")).toBe(result);
  });

  it("strips path separators and control characters", () => {
    expect(sanitizeDisplayFileName("../../etc/passwd.png")).toBe("....etcpasswd.png");
    expect(sanitizeDisplayFileName("bad\x00name.png")).toBe("badname.png");
  });

  it("strips characters Windows forbids in a filename", () => {
    expect(sanitizeDisplayFileName('weird:*?"<>|name.png')).toBe("weirdname.png");
  });

  it("disambiguates a Windows-reserved device name", () => {
    expect(sanitizeDisplayFileName("CON.png")).toBe("CON_file.png");
    expect(sanitizeDisplayFileName("com1.png")).toBe("com1_file.png"); // case-insensitive
    expect(sanitizeDisplayFileName("Constellation.png")).toBe("Constellation.png"); // not an exact reserved-name match
  });

  it("strips trailing dots and spaces", () => {
    expect(sanitizeDisplayFileName("trailing... .png")).toBe("trailing.png");
  });

  it("falls back to Untitled for an empty or fully-stripped name", () => {
    expect(sanitizeDisplayFileName("")).toBe("Untitled");
    expect(sanitizeDisplayFileName("///")).toBe("Untitled");
  });

  it("truncates an excessively long name while preserving the extension", () => {
    const longName = `${"a".repeat(500)}.png`;
    const result = sanitizeDisplayFileName(longName);
    expect(result.length).toBeLessThan(250);
    expect(result.endsWith(".png")).toBe(true);
  });
});

describe("dedupeDisplayName", () => {
  it("returns the name unchanged when it's not already in use", () => {
    expect(dedupeDisplayName("logo.png", new Set())).toBe("logo.png");
  });

  it("appends (2), (3), ... until a free name is found", () => {
    expect(dedupeDisplayName("logo.png", new Set(["logo.png"]))).toBe("logo (2).png");
    expect(dedupeDisplayName("logo.png", new Set(["logo.png", "logo (2).png"]))).toBe("logo (3).png");
  });

  it("handles a name with no extension", () => {
    expect(dedupeDisplayName("readme", new Set(["readme"]))).toBe("readme (2)");
  });
});
