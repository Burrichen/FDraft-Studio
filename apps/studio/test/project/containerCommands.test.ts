// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createId, createProject, type StudioProjectDocument } from "@fdraft/theme-sdk";
import {
  buildAddMasterCommand,
  buildAddPageCommand,
  buildAddPopupCommand,
  buildDeleteMasterCommand,
  buildDeletePageCommand,
  buildDeletePopupCommand,
  buildDetachFromMasterCommand,
  buildDuplicatePageCommand,
  buildDuplicatePopupCommand,
  buildReorderPagesCommand,
  findMasterDependents,
  renamePage,
  renamePopup,
  setContainerMaster,
  setMasterLayerOverride,
  slugify,
  wouldCreateMasterCycle,
} from "../../src/project/containerCommands.js";

function project(): StudioProjectDocument {
  return createProject({ id: createId(), name: "Test" });
}

function shapeLayer(id: string) {
  return { id, type: "shape" as const, name: id, shape: "rect" as const, transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, scaleX: 1, scaleY: 1 }, opacity: 1, visible: true, locked: false, zIndex: 0, responsive: [], interactionStates: [] };
}

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("About Us!", new Set())).toBe("about-us");
  });
  it("dedupes against existing slugs", () => {
    expect(slugify("Home", new Set(["home"]))).toBe("home-2");
    expect(slugify("Home", new Set(["home", "home-2"]))).toBe("home-3");
  });
  it("falls back to 'page' for a name with no valid characters", () => {
    expect(slugify("!!!", new Set())).toBe("page");
  });
});

describe("pages: add/rename/duplicate/reorder/delete", () => {
  it("adds a page with a unique slug and undoes", () => {
    const p = project();
    const cmd = buildAddPageCommand(p, "Home");
    const after = cmd.do(p);
    expect(after.pages).toHaveLength(1);
    expect(after.pages[0]!.slug).toBe("home");
    expect(cmd.undo(after).pages).toHaveLength(0);
  });

  it("renames a page and undoes", () => {
    let p = project();
    p = buildAddPageCommand(p, "Home").do(p);
    const pageId = p.pages[0]!.id;
    const cmd = renamePage(p, pageId, "Landing")!;
    const after = cmd.do(p);
    expect(after.pages[0]!.name).toBe("Landing");
    expect(cmd.undo(after).pages[0]!.name).toBe("Home");
  });

  it("duplicates a page with fresh layer ids and a deduped slug", () => {
    let p = project();
    p = buildAddPageCommand(p, "Home").do(p);
    p = { ...p, pages: [{ ...p.pages[0]!, layers: [shapeLayer("l1")] }] };
    const cmd = buildDuplicatePageCommand(p, p.pages[0]!.id)!;
    const after = cmd.do(p);
    expect(after.pages).toHaveLength(2);
    expect(after.pages[1]!.slug).not.toBe(after.pages[0]!.slug);
    expect(after.pages[1]!.layers[0]!.id).not.toBe("l1");
    expect(cmd.undo(after).pages).toHaveLength(1);
  });

  it("reorders pages and undo restores the original order", () => {
    let p = project();
    p = buildAddPageCommand(p, "A").do(p);
    p = buildAddPageCommand(p, "B").do(p);
    p = buildAddPageCommand(p, "C").do(p);
    const [a] = p.pages;
    const cmd = buildReorderPagesCommand(p, a!.id, 2)!;
    const after = cmd.do(p);
    expect(after.pages.map((x) => x.name)).toEqual(["B", "C", "A"]);
    expect(cmd.undo(after).pages.map((x) => x.name)).toEqual(["A", "B", "C"]);
  });

  it("deletes a page at its original index on undo", () => {
    let p = project();
    p = buildAddPageCommand(p, "A").do(p);
    p = buildAddPageCommand(p, "B").do(p);
    const cmd = buildDeletePageCommand(p, p.pages[0]!.id)!;
    const after = cmd.do(p);
    expect(after.pages.map((x) => x.name)).toEqual(["B"]);
    expect(cmd.undo(after).pages.map((x) => x.name)).toEqual(["A", "B"]);
  });
});

describe("popups: add/rename/duplicate/delete", () => {
  it("adds, renames, duplicates, and deletes a popup", () => {
    let p = project();
    p = buildAddPopupCommand("Welcome").do(p);
    expect(p.popups).toHaveLength(1);

    const renameCmd = renamePopup(p, p.popups[0]!.id, "Intro")!;
    p = renameCmd.do(p);
    expect(p.popups[0]!.name).toBe("Intro");

    const dupCmd = buildDuplicatePopupCommand(p, p.popups[0]!.id)!;
    p = dupCmd.do(p);
    expect(p.popups).toHaveLength(2);
    expect(p.popups[1]!.id).not.toBe(p.popups[0]!.id);

    const deleteCmd = buildDeletePopupCommand(p, p.popups[0]!.id)!;
    p = deleteCmd.do(p);
    expect(p.popups).toHaveLength(1);
    p = deleteCmd.undo(p);
    expect(p.popups).toHaveLength(2);
  });
});

describe("masters: dependents, cycles, delete", () => {
  it("finds pages/popups/masters that depend on a master", () => {
    let p = project();
    p = buildAddMasterCommand("Base").do(p);
    const masterId = p.masters[0]!.id;
    p = buildAddPageCommand(p, "Home").do(p);
    p = { ...p, pages: [{ ...p.pages[0]!, masterId }] };
    p = buildAddMasterCommand("Child", masterId).do(p);

    const dependents = findMasterDependents(p, masterId);
    expect(dependents.map((d) => d.kind).sort()).toEqual(["master", "page"]);
  });

  it("refuses to delete a master with dependents", () => {
    let p = project();
    p = buildAddMasterCommand("Base").do(p);
    const masterId = p.masters[0]!.id;
    p = buildAddPageCommand(p, "Home").do(p);
    p = { ...p, pages: [{ ...p.pages[0]!, masterId }] };
    expect(buildDeleteMasterCommand(p, masterId)).toBeNull();
  });

  it("deletes a master with no dependents and undo restores it", () => {
    let p = project();
    p = buildAddMasterCommand("Base").do(p);
    const masterId = p.masters[0]!.id;
    const cmd = buildDeleteMasterCommand(p, masterId)!;
    const after = cmd.do(p);
    expect(after.masters).toHaveLength(0);
    expect(cmd.undo(after).masters).toHaveLength(1);
  });

  it("detects a direct and an indirect master inheritance cycle", () => {
    let p = project();
    p = buildAddMasterCommand("A").do(p);
    const a = p.masters[0]!.id;
    p = buildAddMasterCommand("B", a).do(p);
    const b = p.masters[1]!.id;

    expect(wouldCreateMasterCycle(p, a, a)).toBe(true); // self-parent
    expect(wouldCreateMasterCycle(p, a, b)).toBe(true); // a -> b -> a would cycle
    expect(wouldCreateMasterCycle(p, b, a)).toBe(false); // b already -> a, not a cycle to confirm it
  });
});

describe("setContainerMaster", () => {
  it("assigns and clears a page's master, undoably", () => {
    let p = project();
    p = buildAddMasterCommand("Base").do(p);
    const masterId = p.masters[0]!.id;
    p = buildAddPageCommand(p, "Home").do(p);
    const pageId = p.pages[0]!.id;

    const assignCmd = setContainerMaster(p, "page", pageId, masterId)!;
    const afterAssign = assignCmd.do(p);
    expect(afterAssign.pages[0]!.masterId).toBe(masterId);
    expect(assignCmd.undo(afterAssign).pages[0]!.masterId).toBeUndefined();
  });

  it("returns null when the master is already what's set", () => {
    let p = project();
    p = buildAddPageCommand(p, "Home").do(p);
    expect(setContainerMaster(p, "page", p.pages[0]!.id, undefined)).toBeNull();
  });
});

describe("setMasterLayerOverride / buildDetachFromMasterCommand", () => {
  function withMasterAndPage() {
    let p = project();
    p = buildAddMasterCommand("Base").do(p);
    const masterId = p.masters[0]!.id;
    p = { ...p, masters: [{ ...p.masters[0]!, layers: [shapeLayer("bg")] }] };
    p = buildAddPageCommand(p, "Home").do(p);
    const pageId = p.pages[0]!.id;
    p = setContainerMaster(p, "page", pageId, masterId)!.do(p);
    return { project: p, masterId, pageId };
  }

  it("sets an override, identifiable via masterLayerOverrides, and resets it by setting undefined", () => {
    const { project: p, pageId } = withMasterAndPage();
    const setCmd = setMasterLayerOverride(p, "page", pageId, "bg", { visible: false })!;
    const after = setCmd.do(p);
    expect(after.pages[0]!.masterLayerOverrides?.bg).toEqual({ visible: false });

    const resetCmd = setMasterLayerOverride(after, "page", pageId, "bg", undefined)!;
    const reset = resetCmd.do(after);
    expect(reset.pages[0]!.masterLayerOverrides).toBeUndefined();
  });

  it("undoing a set override restores the previous override state", () => {
    const { project: p, pageId } = withMasterAndPage();
    const setCmd = setMasterLayerOverride(p, "page", pageId, "bg", { visible: false })!;
    const after = setCmd.do(p);
    const undone = setCmd.undo(after);
    expect(undone.pages[0]!.masterLayerOverrides).toBeUndefined();
  });

  it("detaches a page from its master, materialising inherited layers with fresh ids", () => {
    const { project: p, pageId } = withMasterAndPage();
    const cmd = buildDetachFromMasterCommand(p, "page", pageId)!;
    const after = cmd.do(p);
    const page = after.pages[0]!;
    expect(page.masterId).toBeUndefined();
    expect(page.masterLayerOverrides).toBeUndefined();
    expect(page.layers).toHaveLength(1);
    expect(page.layers[0]!.id).not.toBe("bg"); // fresh id, never collides with the master's own

    const undone = cmd.undo(after);
    expect(undone.pages[0]!.masterId).toBe(p.pages[0]!.masterId);
    expect(undone.pages[0]!.layers).toEqual(p.pages[0]!.layers);
  });

  it("returns null detaching a page that has no master", () => {
    let p = project();
    p = buildAddPageCommand(p, "Home").do(p);
    expect(buildDetachFromMasterCommand(p, "page", p.pages[0]!.id)).toBeNull();
  });
});
