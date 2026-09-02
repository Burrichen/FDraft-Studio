import { useEffect, useState, type RefObject } from "react";

/**
 * True only while an element is genuinely worth animating: the document
 * is visible (not a hidden/minimised background tab), the window has
 * focus, and the element itself is actually intersecting the viewport.
 * Backs the "pause/throttle when hidden, minimised, unfocused, or
 * offscreen" requirement for effect canvases — a host embedding this
 * renderer never has to implement this itself.
 */
export function usePlaybackGate(elementRef: RefObject<Element | null>): boolean {
  const [documentVisible, setDocumentVisible] = useState(() => (typeof document === "undefined" ? true : document.visibilityState !== "hidden"));
  // Optimistically focused until a real `blur` event says otherwise — `document.hasFocus()` is unreliable across
  // some embedding contexts (iframes, certain webviews) in a way a dispatched blur/focus event pair isn't.
  const [windowFocused, setWindowFocused] = useState(true);
  const [intersecting, setIntersecting] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => setDocumentVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBlur = () => setWindowFocused(false);
    const onFocus = () => setWindowFocused(true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => setIntersecting(entries[0]?.isIntersecting ?? true), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [elementRef]);

  return documentVisible && windowFocused && intersecting;
}
