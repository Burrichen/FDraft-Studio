import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus-trap + Escape-to-close + initial-focus + focus-restore for a
 * modal dialog — attach the returned ref to the dialog's own root element
 * (the one carrying `role="dialog"`, with `tabIndex={-1}` so it's a valid
 * programmatic-focus fallback without joining the normal tab order).
 * Before this, none of Studio's 7 modals trapped focus or closed on
 * Escape (confirmed by direct inspection) — Tab could leave the dialog
 * into the background canvas/panels while it was "open." One shared,
 * tested primitive instead of seven divergent implementations.
 */
export function useModalA11y(onClose: () => void): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function focusables(): HTMLElement[] {
      if (!container) return [];
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    const initial = focusables()[0] ?? container;
    initial?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    container?.addEventListener("keydown", onKeyDown);
    return () => {
      container?.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return containerRef;
}
