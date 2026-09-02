import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { readZipSafely, createDeterministicZip } from "../../src/packaging/zip.js";
import {
  assertSafeArchiveEntry,
  isPathSafeInArchive,
  MAX_ARCHIVE_COMPRESSION_RATIO,
  MAX_FILE_SIZE_BYTES,
} from "../../src/packaging/security.js";
import { RelativeAssetPathSchema } from "../../src/schema/primitives.js";
import { SdkError } from "../../src/errors.js";

describe("archive security policy", () => {
  it("rejects zip-slip path traversal (../) before extracting anything", () => {
    const malicious = zipSync({ "../evil.txt": new TextEncoder().encode("pwned") });
    let caught: unknown;
    try {
      readZipSafely(malicious);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("ZIP_PATH_TRAVERSAL");
  });

  it("rejects an absolute path entry", () => {
    const malicious = zipSync({ "/etc/passwd": new TextEncoder().encode("x") });
    expect(() => readZipSafely(malicious)).toThrow(SdkError);
  });

  it("rejects a Windows drive-letter path entry", () => {
    const malicious = zipSync({ "C:/Windows/System32/evil.dll": new TextEncoder().encode("x") });
    expect(() => readZipSafely(malicious)).toThrow(SdkError);
  });

  it("rejects a dangerous executable extension regardless of declared kind", () => {
    const malicious = zipSync({ "assets/payload.exe": new TextEncoder().encode("MZ") });
    let caught: unknown;
    try {
      readZipSafely(malicious);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("DANGEROUS_FILE_TYPE");
  });

  it("rejects an asset extension outside the safe allowlist even if not classically 'dangerous'", () => {
    const malicious = zipSync({ "assets/data.json": new TextEncoder().encode("{}") });
    expect(() => readZipSafely(malicious)).toThrow(SdkError);
  });

  it("detects an archive-bomb-shaped entry (extreme compression ratio) before inflating it", () => {
    // 8 MB of zeros compresses to a few hundred bytes — a real, cheap
    // stand-in for a zip bomb, well over MAX_ARCHIVE_COMPRESSION_RATIO.
    const zeros = new Uint8Array(8 * 1024 * 1024);
    const bomb = zipSync({ "assets/bomb.png": [zeros, { level: 9 }] });

    let caught: unknown;
    try {
      readZipSafely(bomb);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("COMPRESSION_RATIO_EXCEEDED");
  });

  it("assertSafeArchiveEntry rejects a file over the per-file size cap", () => {
    expect(() =>
      assertSafeArchiveEntry({ path: "assets/huge.png", compressedSize: 1, uncompressedSize: MAX_FILE_SIZE_BYTES + 1 }),
    ).toThrow(SdkError);
  });

  it("assertSafeArchiveEntry rejects a ratio just over the limit and accepts one just under it", () => {
    const compressedSize = 1000;
    expect(() =>
      assertSafeArchiveEntry({ path: "assets/x.png", compressedSize, uncompressedSize: compressedSize * (MAX_ARCHIVE_COMPRESSION_RATIO + 1) }),
    ).toThrow(SdkError);
    expect(() =>
      assertSafeArchiveEntry({ path: "assets/x.png", compressedSize, uncompressedSize: compressedSize * (MAX_ARCHIVE_COMPRESSION_RATIO - 1) }),
    ).not.toThrow();
  });

  it("rejects an archive with more files than the file-count limit", () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 5001; i += 1) files[`assets/f${i}.png`] = new Uint8Array([1]);
    const archive = zipSync(files);
    let caught: unknown;
    try {
      readZipSafely(archive);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SdkError);
    expect((caught as SdkError).code).toBe("ARCHIVE_TOO_MANY_FILES");
  }, 20_000);

  it("round-trips a legitimate archive with an ordinary file count and ratio", () => {
    const archive = createDeterministicZip({ "manifest.json": new TextEncoder().encode("{}"), "assets/a.png": new Uint8Array([1, 2, 3]) });
    const extracted = readZipSafely(archive);
    expect(Object.keys(extracted).sort()).toEqual(["assets/a.png", "manifest.json"]);
  });
});

describe("path safety helpers", () => {
  it("accepts a forward-slash relative Unicode filename", () => {
    expect(isPathSafeInArchive("assets/hallowe\u2019en-\uD83C\uDF83.png")).toBe(true);
    expect(() => RelativeAssetPathSchema.parse("assets/hallowe\u2019en-\uD83C\uDF83.png")).not.toThrow();
  });

  it("rejects a Windows-style backslash path", () => {
    expect(isPathSafeInArchive("assets\\image.png")).toBe(false);
    expect(RelativeAssetPathSchema.safeParse("assets\\image.png").success).toBe(false);
  });

  it("rejects a remote URL used as a path", () => {
    expect(isPathSafeInArchive("https://evil.example/x.png")).toBe(false);
    expect(RelativeAssetPathSchema.safeParse("https://evil.example/x.png").success).toBe(false);
  });

  it("rejects traversal segments", () => {
    expect(isPathSafeInArchive("assets/../../etc/passwd")).toBe(false);
    expect(RelativeAssetPathSchema.safeParse("assets/../secrets.png").success).toBe(false);
  });
});
