// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CommandStack } from "../../src/history/commandStack.js";
import { setProjectMetadataCommand } from "../../src/history/projectCommands.js";
import { createMinimalProjectTemplate } from "../../src/project/projectFile.js";

describe("setProjectMetadataCommand", () => {
  it("applies and undoes a name/description edit through the command stack", () => {
    const stack = new CommandStack<ReturnType<typeof createMinimalProjectTemplate>>();
    let project = createMinimalProjectTemplate("Original Name");

    project = stack.execute(project, setProjectMetadataCommand({ name: "New Name", description: "New description" }, project.metadata));
    expect(project.metadata.name).toBe("New Name");
    expect(project.metadata.description).toBe("New description");
    expect(project.metadata.id).toBeTruthy(); // id is preserved, never changed by a metadata edit

    project = stack.undo(project);
    expect(project.metadata.name).toBe("Original Name");
  });
});
