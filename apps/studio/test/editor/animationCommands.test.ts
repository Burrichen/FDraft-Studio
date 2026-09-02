// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject } from "@fdraft/theme-sdk";
import type { StudioProjectDocument } from "@fdraft/theme-sdk";
import { buildAddAnimationCommand, buildUpdateAnimationCommand, buildDeleteAnimationCommand } from "../../src/editor/animationCommands.js";
import { getContainerAnimations } from "../../src/editor/containerRef.js";

function project(): StudioProjectDocument {
  const p = createProject({ id: createId(), name: "Test" });
  p.pages.push({ id: "page-1", name: "Home", slug: "home", layers: [], animations: [] });
  return p;
}

const ref = { kind: "page" as const, id: "page-1" };

describe("buildAddAnimationCommand", () => {
  it("adds a schema-valid onEnter fade animation targeting the given layer, and undoes cleanly", () => {
    const p = project();
    const { command, animation } = buildAddAnimationCommand(ref, "layer-1");
    expect(animation.trigger).toBe("onEnter");
    expect(animation.motion).toEqual({ type: "preset", preset: "fade" });
    expect(animation.targetLayerId).toBe("layer-1");

    const after = command.do(p);
    expect(getContainerAnimations(after, ref)).toEqual([animation]);
    expect(getContainerAnimations(command.undo(after), ref)).toEqual([]);
  });

  it("accepts a different preset", () => {
    const { animation } = buildAddAnimationCommand(ref, "layer-1", "pulse");
    expect(animation.motion).toEqual({ type: "preset", preset: "pulse" });
  });
});

describe("buildUpdateAnimationCommand / buildDeleteAnimationCommand", () => {
  it("updates and undoes a change to an existing animation", () => {
    let p = project();
    const { command: addCmd, animation } = buildAddAnimationCommand(ref, "layer-1");
    p = addCmd.do(p);

    const updated = { ...animation, durationMs: 900 };
    const updateCmd = buildUpdateAnimationCommand(ref, animation.id, animation, updated);
    const after = updateCmd.do(p);
    expect(getContainerAnimations(after, ref)[0]!.durationMs).toBe(900);
    expect(getContainerAnimations(updateCmd.undo(after), ref)[0]!.durationMs).toBe(400);
  });

  it("deletes and undoes an animation", () => {
    let p = project();
    const { command: addCmd, animation } = buildAddAnimationCommand(ref, "layer-1");
    p = addCmd.do(p);

    const deleteCmd = buildDeleteAnimationCommand(ref, animation);
    const after = deleteCmd.do(p);
    expect(getContainerAnimations(after, ref)).toEqual([]);
    expect(getContainerAnimations(deleteCmd.undo(after), ref)).toEqual([animation]);
  });
});
