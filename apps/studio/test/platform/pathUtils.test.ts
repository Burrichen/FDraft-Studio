import { describe, expect, it } from "vitest";
import { basenamePath, dirnamePath, joinPath, stemName } from "../../src/platform/pathUtils.js";

describe("pathUtils (POSIX-style paths)", () => {
  it("joins segments with forward slashes", () => {
    expect(joinPath("/Users/isaac/Projects", "my-event", "project.fdstudio")).toBe("/Users/isaac/Projects/my-event/project.fdstudio");
  });

  it("computes dirname/basename", () => {
    expect(dirnamePath("/Users/isaac/Projects/my-event/project.fdstudio")).toBe("/Users/isaac/Projects/my-event");
    expect(basenamePath("/Users/isaac/Projects/my-event/project.fdstudio")).toBe("project.fdstudio");
  });

  it("strips a matching extension for stemName", () => {
    expect(stemName("/a/b/My Project.fdstudio", ".fdstudio")).toBe("My Project");
  });
});

describe("pathUtils (Windows-style paths)", () => {
  it("joins segments with backslashes when the first segment is Windows-style", () => {
    expect(joinPath("C:\\Users\\isaac\\Documents", "My Event", "project.fdstudio")).toBe("C:\\Users\\isaac\\Documents\\My Event\\project.fdstudio");
  });

  it("computes dirname/basename for a drive-letter path", () => {
    expect(dirnamePath("C:\\Users\\isaac\\Documents\\My Event\\project.fdstudio")).toBe("C:\\Users\\isaac\\Documents\\My Event");
    expect(basenamePath("C:\\Users\\isaac\\Documents\\My Event\\project.fdstudio")).toBe("project.fdstudio");
  });

  it("preserves the drive root when dirname reaches the top", () => {
    expect(dirnamePath("C:\\project.fdstudio")).toBe("C:\\");
  });
});
