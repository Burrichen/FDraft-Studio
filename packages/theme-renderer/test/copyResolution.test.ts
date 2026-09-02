import { describe, expect, it } from "vitest";
import type { ComponentCopySlotDeclaration } from "../src/types.js";
import { resolveComponentCopy, substitutePlaceholders } from "../src/copyResolution.js";

describe("substitutePlaceholders", () => {
  it("substitutes an allowed placeholder with its resolved value", () => {
    expect(substitutePlaceholders("Hello {{eventName}}!", ["eventName"], { eventName: "Halloween Bash" })).toBe("Hello Halloween Bash!");
  });

  it("leaves a disallowed placeholder as a literal token", () => {
    expect(substitutePlaceholders("Hello {{eventName}}!", [], { eventName: "Halloween Bash" })).toBe("Hello {{eventName}}!");
  });

  it("leaves an unresolved (no value supplied) placeholder as a literal token rather than blanking it", () => {
    expect(substitutePlaceholders("Hello {{eventName}}!", ["eventName"], {})).toBe("Hello {{eventName}}!");
    expect(substitutePlaceholders("Hello {{eventName}}!", ["eventName"], undefined)).toBe("Hello {{eventName}}!");
  });

  it("substitutes multiple distinct placeholders", () => {
    expect(substitutePlaceholders("{{watchedCount}} of {{targetCount}}", ["watchedCount", "targetCount"], { watchedCount: "3", targetCount: "10" })).toBe("3 of 10");
  });
});

describe("resolveComponentCopy", () => {
  const slots: ComponentCopySlotDeclaration[] = [
    { key: "title", label: "Title", defaultText: "Default Title", required: true },
    { key: "subtitle", label: "Subtitle", defaultText: "Default Subtitle", required: false },
  ];

  it("uses the default text when no override is set at all", () => {
    const copy = resolveComponentCopy(slots, undefined, undefined);
    expect(copy).toEqual({ title: "Default Title", subtitle: "Default Subtitle" });
  });

  it("uses the theme-authored override when present", () => {
    const copy = resolveComponentCopy(slots, { title: "Custom Title" }, undefined);
    expect(copy.title).toBe("Custom Title");
    expect(copy.subtitle).toBe("Default Subtitle");
  });

  it("falls back to the default for a required slot left blank", () => {
    const copy = resolveComponentCopy(slots, { title: "   " }, undefined);
    expect(copy.title).toBe("Default Title");
  });

  it("respects a deliberately blank override for an optional slot", () => {
    const copy = resolveComponentCopy(slots, { subtitle: "" }, undefined);
    expect(copy.subtitle).toBe("");
  });

  it("substitutes placeholders in the resolved text", () => {
    const withPlaceholder: ComponentCopySlotDeclaration[] = [{ key: "greeting", label: "Greeting", defaultText: "Hi {{eventName}}", required: true, allowedPlaceholders: ["eventName"] }];
    const copy = resolveComponentCopy(withPlaceholder, undefined, { eventName: "Halloween Bash" });
    expect(copy.greeting).toBe("Hi Halloween Bash");
  });

  it("returns an empty object for no declared slots", () => {
    expect(resolveComponentCopy([], { anything: "x" }, undefined)).toEqual({});
  });
});
