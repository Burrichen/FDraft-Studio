import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useModalA11y } from "../../src/ui/useModalA11y.js";

function TestModal({ onClose }: { onClose: () => void }): React.ReactNode {
  const modalRef = useModalA11y(onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label="Test modal" ref={modalRef} tabIndex={-1}>
      <button type="button">First</button>
      <button type="button">Second</button>
      <button type="button">Last</button>
    </div>
  );
}

function Harness(): React.ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open modal
      </button>
      {open && <TestModal onClose={() => setOpen(false)} />}
    </div>
  );
}

describe("useModalA11y", () => {
  it("focuses the first focusable element inside the modal on mount", () => {
    render(<TestModal onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TestModal onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab focus: tabbing past the last element wraps to the first", async () => {
    const user = userEvent.setup();
    render(<TestModal onClose={vi.fn()} />);
    screen.getByRole("button", { name: "Last" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
  });

  it("traps Shift+Tab focus: shift-tabbing back from the first element wraps to the last", async () => {
    const user = userEvent.setup();
    render(<TestModal onClose={vi.fn()} />);
    screen.getByRole("button", { name: "First" }).focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Last" }));
  });

  it("restores focus to the trigger element once the modal closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open modal" });

    await user.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
