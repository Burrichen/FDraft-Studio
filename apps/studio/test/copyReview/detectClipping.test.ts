import { describe, expect, it } from "vitest";
import { hasTextOverflow } from "../../src/copyReview/detectClipping.js";

function elementWithBox(box: { scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number }): Element {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollWidth", { value: box.scrollWidth });
  Object.defineProperty(el, "clientWidth", { value: box.clientWidth });
  Object.defineProperty(el, "scrollHeight", { value: box.scrollHeight });
  Object.defineProperty(el, "clientHeight", { value: box.clientHeight });
  return el;
}

describe("hasTextOverflow", () => {
  it("is false when content fits exactly", () => {
    expect(hasTextOverflow(elementWithBox({ scrollWidth: 200, clientWidth: 200, scrollHeight: 60, clientHeight: 60 }))).toBe(false);
  });

  it("is true when scrollWidth exceeds clientWidth", () => {
    expect(hasTextOverflow(elementWithBox({ scrollWidth: 260, clientWidth: 200, scrollHeight: 60, clientHeight: 60 }))).toBe(true);
  });

  it("is true when scrollHeight exceeds clientHeight (wrapped text overflowing vertically)", () => {
    expect(hasTextOverflow(elementWithBox({ scrollWidth: 200, clientWidth: 200, scrollHeight: 90, clientHeight: 60 }))).toBe(true);
  });

  it("tolerates a 1px rounding difference without flagging it", () => {
    expect(hasTextOverflow(elementWithBox({ scrollWidth: 201, clientWidth: 200, scrollHeight: 60, clientHeight: 60 }))).toBe(false);
  });
});
