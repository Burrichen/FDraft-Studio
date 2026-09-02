// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject } from "@fdraft/theme-sdk";
import type { StudioProjectDocument } from "@fdraft/theme-sdk";
import {
  createDefaultBehaviourRule,
  findFirstLayerId,
  buildAddBehaviourRuleCommand,
  buildDuplicateBehaviourRuleCommand,
  buildDeleteBehaviourRuleCommand,
  buildRenameBehaviourRuleCommand,
  buildSetBehaviourRuleEnabledCommand,
  buildSetBehaviourRulePriorityCommand,
  buildSetBehaviourRuleTriggerCommand,
  buildSetBehaviourRuleConditionCommand,
  buildSetBehaviourRuleActionsCommand,
  buildReorderBehaviourRuleCommand,
} from "../../src/behaviour/behaviourCommands.js";

function projectWithOneLayer(): StudioProjectDocument {
  const project = createProject({ id: createId(), name: "Test" });
  project.pages.push({
    id: createId(),
    name: "Home",
    slug: "home",
    layers: [{ id: "layer-1", type: "shape", name: "Box", shape: "rect", transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] }],
    animations: [],
  });
  return project;
}

describe("findFirstLayerId / createDefaultBehaviourRule", () => {
  it("returns undefined for a project with no layers anywhere", () => {
    const project = createProject({ id: createId(), name: "Empty" });
    expect(findFirstLayerId(project)).toBeUndefined();
    expect(createDefaultBehaviourRule(project)).toBeUndefined();
  });

  it("defaults to the first layer found, with a schema-valid single show action", () => {
    const project = projectWithOneLayer();
    const rule = createDefaultBehaviourRule(project)!;
    expect(rule.actions).toEqual([{ type: "show", layerId: "layer-1" }]);
    expect(rule.trigger).toEqual({ type: "whileTrue" });
    expect(rule.condition).toEqual({ type: "always" });
    expect(rule.enabled).toBe(true);
  });
});

describe("behaviourRule commands", () => {
  it("adds and undoes a rule", () => {
    const project = projectWithOneLayer();
    const rule = createDefaultBehaviourRule(project)!;
    const command = buildAddBehaviourRuleCommand(rule);
    const after = command.do(project);
    expect(after.behaviourRules).toEqual([rule]);
    expect(command.undo(after).behaviourRules).toEqual([]);
  });

  it("duplicates a rule right after the original, with a fresh id, and undoes cleanly", () => {
    const project = projectWithOneLayer();
    const rule = createDefaultBehaviourRule(project)!;
    const withRule = { ...project, behaviourRules: [rule] };
    const command = buildDuplicateBehaviourRuleCommand(rule.id);
    const after = command.do(withRule);
    expect(after.behaviourRules).toHaveLength(2);
    expect(after.behaviourRules[1]!.id).not.toBe(rule.id);
    expect(after.behaviourRules[1]!.name).toBe(`${rule.name} copy`);
    expect(command.undo(after).behaviourRules).toEqual([rule]);
  });

  it("deletes a rule and undo restores it at its original index", () => {
    const project = projectWithOneLayer();
    const ruleA = createDefaultBehaviourRule(project, "A")!;
    const ruleB = { ...createDefaultBehaviourRule(project, "B")!, id: createId() };
    const withRules = { ...project, behaviourRules: [ruleA, ruleB] };
    const command = buildDeleteBehaviourRuleCommand(ruleA.id);
    const after = command.do(withRules);
    expect(after.behaviourRules).toEqual([ruleB]);
    expect(command.undo(after).behaviourRules).toEqual([ruleA, ruleB]);
  });

  it("renames, enables/disables, and sets priority", () => {
    const project = projectWithOneLayer();
    const rule = createDefaultBehaviourRule(project)!;
    let p = { ...project, behaviourRules: [rule] };
    p = buildRenameBehaviourRuleCommand(rule.id, "Renamed").do(p);
    expect(p.behaviourRules[0]!.name).toBe("Renamed");

    const disableCmd = buildSetBehaviourRuleEnabledCommand(rule.id, false);
    p = disableCmd.do(p);
    expect(p.behaviourRules[0]!.enabled).toBe(false);
    p = disableCmd.undo(p);
    expect(p.behaviourRules[0]!.enabled).toBe(true);

    p = buildSetBehaviourRulePriorityCommand(rule.id, 5).do(p);
    expect(p.behaviourRules[0]!.priority).toBe(5);
  });

  it("changes trigger, condition, and actions independently", () => {
    const project = projectWithOneLayer();
    const rule = createDefaultBehaviourRule(project)!;
    let p = { ...project, behaviourRules: [rule] };

    p = buildSetBehaviourRuleTriggerCommand(rule.id, { type: "pageEnter", pageId: project.pages[0]!.id }).do(p);
    expect(p.behaviourRules[0]!.trigger).toEqual({ type: "pageEnter", pageId: project.pages[0]!.id });

    p = buildSetBehaviourRuleConditionCommand(rule.id, { type: "boolean", variable: { kind: "optedIn" }, equals: true }).do(p);
    expect(p.behaviourRules[0]!.condition).toEqual({ type: "boolean", variable: { kind: "optedIn" }, equals: true });

    p = buildSetBehaviourRuleActionsCommand(rule.id, [{ type: "hide", layerId: "layer-1" }]).do(p);
    expect(p.behaviourRules[0]!.actions).toEqual([{ type: "hide", layerId: "layer-1" }]);
  });

  it("reorders a rule up/down, is a no-op past either end, and undoes correctly", () => {
    const project = projectWithOneLayer();
    const ruleA = { ...createDefaultBehaviourRule(project, "A")!, id: "a" };
    const ruleB = { ...createDefaultBehaviourRule(project, "B")!, id: "b" };
    const ruleC = { ...createDefaultBehaviourRule(project, "C")!, id: "c" };
    let p = { ...project, behaviourRules: [ruleA, ruleB, ruleC] };

    const moveBUp = buildReorderBehaviourRuleCommand("b", "up");
    p = moveBUp.do(p);
    expect(p.behaviourRules.map((r) => r.id)).toEqual(["b", "a", "c"]);
    p = moveBUp.undo(p);
    expect(p.behaviourRules.map((r) => r.id)).toEqual(["a", "b", "c"]);

    const moveAUp = buildReorderBehaviourRuleCommand("a", "up");
    expect(moveAUp.do(p).behaviourRules.map((r) => r.id)).toEqual(["a", "b", "c"]);

    const moveCDown = buildReorderBehaviourRuleCommand("c", "down");
    expect(moveCDown.do(p).behaviourRules.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
