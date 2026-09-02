import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef } from "react";
import { usePlaybackGate } from "../src/usePlaybackGate.js";

let intersectionCallback: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
let observed: Element[] = [];

class FakeIntersectionObserver {
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    intersectionCallback = cb;
  }
  observe(el: Element) {
    observed.push(el);
  }
  disconnect() {
    observed = [];
  }
}

function GateProbe({ onGate }: { onGate: (active: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = usePlaybackGate(ref);
  onGate(active);
  return <div ref={ref}>probe</div>;
}

describe("usePlaybackGate", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    intersectionCallback = undefined;
    observed = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("is active by default when visible, focused, and intersecting", () => {
    let latest = false;
    render(<GateProbe onGate={(a) => (latest = a)} />);
    expect(latest).toBe(true);
  });

  it("pauses when the document becomes hidden (a minimised/backgrounded tab)", () => {
    let latest = false;
    render(<GateProbe onGate={(a) => (latest = a)} />);
    expect(latest).toBe(true);

    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(latest).toBe(false);
  });

  it("pauses when the window loses focus", () => {
    let latest = false;
    render(<GateProbe onGate={(a) => (latest = a)} />);
    act(() => window.dispatchEvent(new Event("blur")));
    expect(latest).toBe(false);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(latest).toBe(true);
  });

  it("pauses when the element scrolls offscreen (IntersectionObserver reports not intersecting)", () => {
    let latest = false;
    render(<GateProbe onGate={(a) => (latest = a)} />);
    expect(observed).toHaveLength(1);

    act(() => intersectionCallback?.([{ isIntersecting: false }]));
    expect(latest).toBe(false);

    act(() => intersectionCallback?.([{ isIntersecting: true }]));
    expect(latest).toBe(true);
  });
});
