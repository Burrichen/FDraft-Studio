import { describe, expect, it } from "vitest";
import { assertPathNotTooLongForWindows, isFileLockedError, isMissingPathError, isPathTooLongError, PATH_TOO_LONG_MESSAGE_MARKER } from "../../src/project/projectSession.js";
import { WINDOWS_MAX_PATH } from "../../src/platform/pathUtils.js";

describe("isMissingPathError", () => {
  it("recognizes ENOENT and common missing-path phrasing", () => {
    expect(isMissingPathError(new Error("ENOENT: no such file or directory"))).toBe(true);
    expect(isMissingPathError(new Error("no such file or directory, open 'x'"))).toBe(true);
  });

  it("does not misclassify an unrelated error", () => {
    expect(isMissingPathError(new Error("permission denied"))).toBe(false);
  });
});

describe("isFileLockedError", () => {
  it("recognizes EBUSY and common file-in-use phrasing", () => {
    expect(isFileLockedError(new Error("EBUSY: resource busy or locked, open 'C:\\event.fdstudio'"))).toBe(true);
    expect(isFileLockedError(new Error("The process cannot access the file because it is being used by another process"))).toBe(true);
  });

  it("does not misclassify a missing-path error as locked", () => {
    expect(isFileLockedError(new Error("ENOENT: no such file or directory"))).toBe(false);
  });
});

describe("assertPathNotTooLongForWindows / isPathTooLongError", () => {
  it("does not throw for an ordinary short path", () => {
    expect(() => assertPathNotTooLongForWindows("/Users/dev/Documents/event.fdstudio")).not.toThrow();
  });

  it("throws a recognizable error once the path reaches the Windows MAX_PATH limit", () => {
    const longPath = "C:\\" + "a".repeat(WINDOWS_MAX_PATH);
    let caught: unknown;
    try {
      assertPathNotTooLongForWindows(longPath);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain(PATH_TOO_LONG_MESSAGE_MARKER);
    expect(isPathTooLongError(caught)).toBe(true);
  });

  it("does not misclassify a different error as path-too-long", () => {
    expect(isPathTooLongError(new Error("ENOENT: no such file or directory"))).toBe(false);
  });
});
