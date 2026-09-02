import type { ProjectMetadata, StudioProjectDocument } from "@fdraft/theme-sdk";
import type { Command } from "./commandStack.js";

/** The one real editing command this phase ships: editing a project's own name/description. Later phases add layer/page commands using the same `Command<StudioProjectDocument>` shape. */
export function setProjectMetadataCommand(patch: Partial<Pick<ProjectMetadata, "name" | "description">>, previous: ProjectMetadata): Command<StudioProjectDocument> {
  const next: ProjectMetadata = { ...previous, ...patch };
  return {
    label: "Edit project metadata",
    do: (project) => ({ ...project, metadata: next }),
    undo: (project) => ({ ...project, metadata: previous }),
  };
}
