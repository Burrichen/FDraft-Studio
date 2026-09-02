// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createProject, createId } from "@fdraft/theme-sdk";
import type { StudioProjectDocument } from "@fdraft/theme-sdk";
import { buildAddBorderTokenCommand, buildAddColorTokenCommand, buildAddGradientTokenCommand, buildAddRadiusTokenCommand, buildAddShadowTokenCommand } from "../../src/editor/tokenCommands.js";

function project(): StudioProjectDocument {
  return createProject({ id: createId(), name: "Test" });
}

describe("token creation commands", () => {
  it("adds and undoes a color token", () => {
    const p = project();
    const { command, token } = buildAddColorTokenCommand("Brand Orange", "#f97316");
    const after = command.do(p);
    expect(after.tokens.colors).toEqual([token]);
    expect(command.undo(after).tokens.colors).toEqual([]);
  });

  it("adds a gradient token referencing two color ids", () => {
    const p = project();
    const { command, token } = buildAddGradientTokenCommand("Sunset", ["c1", "c2"]);
    const after = command.do(p);
    expect(after.tokens.gradients).toEqual([token]);
    expect(token.stops.map((s) => s.colorTokenId)).toEqual(["c1", "c2"]);
    expect(command.undo(after).tokens.gradients).toEqual([]);
  });

  it("adds a border token and undoes", () => {
    const p = project();
    const { command, token } = buildAddBorderTokenCommand("Thin", "c1");
    const after = command.do(p);
    expect(after.tokens.borders).toEqual([token]);
    expect(command.undo(after).tokens.borders).toEqual([]);
  });

  it("adds a radius token with no color dependency", () => {
    const p = project();
    const { command, token } = buildAddRadiusTokenCommand("Small", 8);
    const after = command.do(p);
    expect(after.tokens.radii).toEqual([token]);
    expect(token.value).toBe(8);
  });

  it("adds a shadow token and undoes", () => {
    const p = project();
    const { command, token } = buildAddShadowTokenCommand("Drop", "c1");
    const after = command.do(p);
    expect(after.tokens.shadows).toEqual([token]);
    expect(command.undo(after).tokens.shadows).toEqual([]);
  });
});
