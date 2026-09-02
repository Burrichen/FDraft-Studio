import { describe, expect, it } from "vitest";
import { checkSvgSafety, isSvgSafe, sanitizeSvg } from "../../src/validation/svg.js";

describe("SVG safety policy", () => {
  it("accepts a plain, self-contained SVG", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#f00"/></svg>`;
    expect(isSvgSafe(svg)).toBe(true);
    expect(checkSvgSafety(svg)).toEqual([]);
  });

  it("rejects <script> elements", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`;
    expect(isSvgSafe(svg)).toBe(false);
    expect(checkSvgSafety(svg)).toContainEqual(expect.objectContaining({ rule: "no-script" }));
  });

  it("rejects on* event handler attributes", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" width="1" height="1"/></svg>`;
    expect(isSvgSafe(svg)).toBe(false);
    expect(checkSvgSafety(svg)).toContainEqual(expect.objectContaining({ rule: "no-event-handlers" }));
  });

  it("rejects javascript: URIs", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="1" height="1"/></a></svg>`;
    expect(isSvgSafe(svg)).toBe(false);
  });

  it("rejects a remote <image> reference", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>`;
    expect(isSvgSafe(svg)).toBe(false);
    expect(checkSvgSafety(svg)).toContainEqual(expect.objectContaining({ rule: "no-remote-image" }));
  });

  it("rejects <foreignObject>", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject></svg>`;
    expect(isSvgSafe(svg)).toBe(false);
  });

  it("rejects a document with no <svg> root", () => {
    expect(isSvgSafe("<not-svg></not-svg>")).toBe(false);
  });
});

describe("sanitizeSvg", () => {
  it("leaves an already-clean SVG untouched", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#f00"/></svg>`;
    const result = sanitizeSvg(svg);
    expect(result.clean).toBe(true);
    expect(result.sanitized).toBe(svg);
    expect(result.removed).toEqual([]);
  });

  it("strips <script> and reports it removed, leaving the rest intact", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="4"/></svg>`;
    const result = sanitizeSvg(svg);
    expect(result.clean).toBe(true);
    expect(result.sanitized).not.toContain("<script");
    expect(result.sanitized).toContain("<circle");
    expect(result.removed).toContainEqual(expect.objectContaining({ rule: "no-script" }));
    expect(isSvgSafe(result.sanitized!)).toBe(true);
  });

  it("strips on* event handler attributes but keeps the element", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" width="1" height="1"/></svg>`;
    const result = sanitizeSvg(svg);
    expect(result.clean).toBe(true);
    expect(result.sanitized).not.toContain("onclick");
    expect(result.sanitized).toContain("<rect");
  });

  it("strips foreignObject entirely", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject><circle r="1"/></svg>`;
    const result = sanitizeSvg(svg);
    expect(result.clean).toBe(true);
    expect(result.sanitized).not.toContain("foreignObject");
    expect(result.sanitized).toContain("<circle");
  });

  it("strips an external href but keeps a local fragment href", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="c"><rect width="1" height="1"/></clipPath></defs><use href="#c"/><image href="https://evil.example/x.png"/></svg>`;
    const result = sanitizeSvg(svg);
    expect(result.clean).toBe(true);
    expect(result.sanitized).not.toContain("evil.example");
    expect(result.sanitized).toContain('href="#c"');
  });

  it("strips javascript: URIs", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="1" height="1"/></a></svg>`;
    const result = sanitizeSvg(svg);
    expect(result.clean).toBe(true);
    expect(result.sanitized).not.toContain("javascript:");
  });

  it("strips @import and custom entities", () => {
    const svg = `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe "boom">]><svg xmlns="http://www.w3.org/2000/svg"><style>@import url(evil.css);</style><circle r="1"/></svg>`;
    const result = sanitizeSvg(svg);
    expect(result.clean).toBe(true);
    expect(result.sanitized).not.toContain("@import");
    expect(result.sanitized).not.toContain("<!ENTITY");
  });

  it("refuses to sanitise a document with no <svg> root at all", () => {
    const result = sanitizeSvg("<not-svg><script>alert(1)</script></not-svg>");
    expect(result.sanitized).toBeUndefined();
    expect(result.clean).toBe(false);
  });
});
