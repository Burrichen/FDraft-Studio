/**
 * A command-based undo/redo engine, generic over whatever state type a
 * host applies it to (here, `StudioProjectDocument`). Deliberately
 * framework-agnostic — no React — so it's usable from a plain reducer and
 * unit-testable without mounting anything.
 */
export interface Command<S> {
  label: string;
  /** Pure: returns the new state. Must not mutate `state` in place. */
  do: (state: S) => S;
  /** Pure: returns the state as it was before `do` ran. */
  undo: (state: S) => S;
}

export interface CommandStackOptions {
  /**
   * Cap on the number of undo entries kept. Generous but bounded — the
   * oldest entry is dropped once the cap is exceeded, so unlimited
   * editing never grows memory unboundedly. Default 100.
   */
  maxHistory?: number;
}

const DEFAULT_MAX_HISTORY = 100;

/**
 * Stateless from the *document's* point of view — `execute`/`undo`/`redo`
 * all take the current state in and return the next state out; the stack
 * itself only remembers *commands*, not document snapshots, keeping
 * memory proportional to the number of edits rather than their size.
 */
export class CommandStack<S> {
  private undoStack: Command<S>[] = [];
  private redoStack: Command<S>[] = [];
  private transactionBuffer: Command<S>[] | null = null;
  private transactionLabel = "";
  private readonly maxHistory: number;

  constructor(options: CommandStackOptions = {}) {
    this.maxHistory = options.maxHistory ?? DEFAULT_MAX_HISTORY;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoLabel(): string | undefined {
    return this.undoStack.at(-1)?.label;
  }

  get redoLabel(): string | undefined {
    return this.redoStack.at(-1)?.label;
  }

  get historyLength(): number {
    return this.undoStack.length;
  }

  /** Runs `command.do`, records it (inside the open transaction if any), and clears the redo stack — the usual undo-history rule once a new edit happens after an undo. */
  execute(state: S, command: Command<S>): S {
    const next = command.do(state);
    if (this.transactionBuffer) {
      this.transactionBuffer.push(command);
    } else {
      this.pushUndo(command);
      this.redoStack = [];
    }
    return next;
  }

  /** Groups every `execute` call until `commitTransaction` into a single undo step labelled `label`. Nesting is not supported — calling this again before committing replaces the pending buffer. */
  beginTransaction(label: string): void {
    this.transactionBuffer = [];
    this.transactionLabel = label;
  }

  /** No-ops (and clears the buffer) if nothing was executed since `beginTransaction`. */
  commitTransaction(): void {
    const commands = this.transactionBuffer;
    this.transactionBuffer = null;
    if (!commands || commands.length === 0) return;

    const label = this.transactionLabel;
    const grouped: Command<S> = {
      label,
      do: (state) => commands.reduce((acc, command) => command.do(acc), state),
      undo: (state) => [...commands].reverse().reduce((acc, command) => command.undo(acc), state),
    };
    this.pushUndo(grouped);
    this.redoStack = [];
  }

  undo(state: S): S {
    const command = this.undoStack.pop();
    if (!command) return state;
    this.redoStack.push(command);
    return command.undo(state);
  }

  redo(state: S): S {
    const command = this.redoStack.pop();
    if (!command) return state;
    this.undoStack.push(command);
    return command.do(state);
  }

  /** Drops all history — used when a project is closed/opened, since undo history never survives a project switch. */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.transactionBuffer = null;
  }

  private pushUndo(command: Command<S>): void {
    this.undoStack.push(command);
    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }
}
