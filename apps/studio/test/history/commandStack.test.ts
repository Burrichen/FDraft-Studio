// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CommandStack, type Command } from "../../src/history/commandStack.js";

function increment(by: number): Command<number> {
  return { label: `+${by}`, do: (n) => n + by, undo: (n) => n - by };
}

describe("CommandStack", () => {
  it("executes and undoes/redoes a single command", () => {
    const stack = new CommandStack<number>();
    let state = 0;
    state = stack.execute(state, increment(5));
    expect(state).toBe(5);
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);

    state = stack.undo(state);
    expect(state).toBe(0);
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(true);

    state = stack.redo(state);
    expect(state).toBe(5);
  });

  it("clears the redo stack once a new command executes after an undo", () => {
    const stack = new CommandStack<number>();
    let state = 0;
    state = stack.execute(state, increment(1));
    state = stack.execute(state, increment(2));
    state = stack.undo(state); // back to 1
    expect(stack.canRedo).toBe(true);

    state = stack.execute(state, increment(10)); // new branch
    expect(state).toBe(11);
    expect(stack.canRedo).toBe(false);
  });

  it("undo/redo on an empty stack is a safe no-op", () => {
    const stack = new CommandStack<number>();
    expect(stack.undo(42)).toBe(42);
    expect(stack.redo(42)).toBe(42);
  });

  it("groups a transaction into a single undo step", () => {
    const stack = new CommandStack<number>();
    let state = 0;
    stack.beginTransaction("Add three");
    state = stack.execute(state, increment(1));
    state = stack.execute(state, increment(1));
    state = stack.execute(state, increment(1));
    stack.commitTransaction();

    expect(state).toBe(3);
    expect(stack.historyLength).toBe(1);
    expect(stack.undoLabel).toBe("Add three");

    state = stack.undo(state);
    expect(state).toBe(0); // the whole transaction undoes at once
  });

  it("commitTransaction with no executed commands is a no-op", () => {
    const stack = new CommandStack<number>();
    stack.beginTransaction("Nothing happened");
    stack.commitTransaction();
    expect(stack.historyLength).toBe(0);
    expect(stack.canUndo).toBe(false);
  });

  it("bounds history to maxHistory entries, dropping the oldest", () => {
    const stack = new CommandStack<number>({ maxHistory: 3 });
    let state = 0;
    for (let i = 0; i < 5; i += 1) {
      state = stack.execute(state, increment(1));
    }
    expect(state).toBe(5);
    expect(stack.historyLength).toBe(3);

    // Only the 3 most recent increments can be undone (5 -> 2), the two
    // oldest are gone for good — a documented, deliberate trade-off.
    state = stack.undo(state);
    state = stack.undo(state);
    state = stack.undo(state);
    expect(state).toBe(2);
    expect(stack.canUndo).toBe(false);
  });

  it("clear() drops all undo/redo history", () => {
    const stack = new CommandStack<number>();
    const state = stack.execute(0, increment(1));
    stack.clear();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
    expect(state).toBe(1); // state itself is untouched by clear()
  });
});
