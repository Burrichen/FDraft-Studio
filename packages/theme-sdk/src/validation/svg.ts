/**
 * Conservative, dependency-free SVG safety policy. This is a blocklist
 * scan, not a full parser — it exists so packaging/compile can reject an
 * obviously unsafe SVG asset before it ever reaches a renderer. A host
 * (Studio or FDraft) MAY layer a stricter DOM-based sanitiser
 * (e.g. DOMPurify) on top using the same `SvgSafetyIssue` shape; the SDK
 * itself stays dependency-free and never executes or DOM-parses SVG.
 */
export interface SvgSafetyIssue {
  rule: string;
  message: string;
}

const DANGEROUS_PATTERNS: { rule: string; pattern: RegExp; message: string }[] = [
  { rule: "no-script", pattern: /<\s*script/i, message: "<script> elements are not allowed" },
  { rule: "no-event-handlers", pattern: /\son[a-z]+\s*=/i, message: "on* event handler attributes are not allowed" },
  { rule: "no-javascript-uri", pattern: /javascript:/i, message: "javascript: URIs are not allowed" },
  { rule: "no-foreign-object", pattern: /<\s*foreignObject/i, message: "<foreignObject> is not allowed" },
  { rule: "no-external-href", pattern: /(?:xlink:href|href)\s*=\s*["'](?!#)(?:https?:)?\/\//i, message: "external href/xlink:href references are not allowed" },
  { rule: "no-remote-image", pattern: /<\s*image[^>]+(?:xlink:href|href)\s*=\s*["'](?!data:)(?!#)/i, message: "<image> must use an inline data: URI or local fragment, never a remote URL" },
  { rule: "no-use-external", pattern: /<\s*use[^>]+(?:xlink:href|href)\s*=\s*["'](?!#)/i, message: "<use> must reference a local fragment (#id), not an external document" },
  { rule: "no-css-import", pattern: /@import/i, message: "@import in <style> is not allowed" },
  { rule: "no-entity-expansion", pattern: /<!ENTITY/i, message: "custom XML entities are not allowed" },
];

export function checkSvgSafety(svgText: string): SvgSafetyIssue[] {
  const issues: SvgSafetyIssue[] = [];
  if (!/<svg[\s>]/i.test(svgText)) {
    issues.push({ rule: "must-be-svg", message: "document does not contain a <svg> root element" });
  }
  for (const { rule, pattern, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(svgText)) issues.push({ rule, message });
  }
  return issues;
}

export function isSvgSafe(svgText: string): boolean {
  return checkSvgSafety(svgText).length === 0;
}

export interface SvgSanitizeResult {
  /** `undefined` when sanitisation could not produce a clean document (e.g. no `<svg>` root at all) — the caller must reject, never fall back to the original text. */
  sanitized: string | undefined;
  /** Every rule that actually matched and was stripped, in the same shape as `checkSvgSafety`'s issues, for an honest "here's what we removed" message to the user. */
  removed: SvgSafetyIssue[];
  /** True only when `sanitized` is defined and re-checking it finds zero remaining issues. */
  clean: boolean;
}

const STRIP_STEPS: { rule: string; message: string; strip: (text: string) => string }[] = [
  { rule: "no-script", message: "<script> elements are not allowed", strip: (t) => t.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "").replace(/<\s*script\b[^>]*\/\s*>/gi, "") },
  { rule: "no-foreign-object", message: "<foreignObject> is not allowed", strip: (t) => t.replace(/<\s*foreignObject\b[^>]*>[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, "").replace(/<\s*foreignObject\b[^>]*\/\s*>/gi, "") },
  { rule: "no-event-handlers", message: "on* event handler attributes are not allowed", strip: (t) => t.replace(/\son[a-z]+\s*=\s*"(?:[^"\\]|\\.)*"/gi, "").replace(/\son[a-z]+\s*=\s*'(?:[^'\\]|\\.)*'/gi, "") },
  {
    rule: "no-javascript-uri",
    message: "javascript: URIs are not allowed",
    strip: (t) => t.replace(/\s(?:xlink:href|href)\s*=\s*"javascript:[^"]*"/gi, "").replace(/\s(?:xlink:href|href)\s*=\s*'javascript:[^']*'/gi, ""),
  },
  {
    rule: "no-external-href",
    message: "external href/xlink:href references are not allowed",
    strip: (t) => t.replace(/\s(?:xlink:href|href)\s*=\s*"(?!#)(?:https?:)?\/\/[^"]*"/gi, "").replace(/\s(?:xlink:href|href)\s*=\s*'(?!#)(?:https?:)?\/\/[^']*'/gi, ""),
  },
  { rule: "no-css-import", message: "@import in <style> is not allowed", strip: (t) => t.replace(/@import\s+[^;]*;?/gi, "") },
  { rule: "no-entity-expansion", message: "custom XML entities are not allowed", strip: (t) => t.replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/gi, "").replace(/<!ENTITY[^>]*>/gi, "") },
];

/**
 * Strips what can be safely stripped (scripts, event handlers,
 * `foreignObject`, external/`javascript:` URLs, `@import`, custom
 * entities) rather than only rejecting outright. Always re-validates the
 * result with `checkSvgSafety` before calling it clean — a regex-based
 * stripper can miss something a determined adversarial file constructs,
 * so `clean: false` (or `sanitized: undefined`) means "reject this file",
 * never "ship it anyway." `no-remote-image`/`no-use-external` are covered
 * by the same href-stripping steps above (they're just more specific
 * instances of an external href), so there's no separate step for them.
 */
export function sanitizeSvg(svgText: string): SvgSanitizeResult {
  if (!/<svg[\s>]/i.test(svgText)) {
    return { sanitized: undefined, removed: [], clean: false };
  }

  let text = svgText;
  const removed: SvgSafetyIssue[] = [];
  for (const step of STRIP_STEPS) {
    const before = text;
    text = step.strip(text);
    if (text !== before) removed.push({ rule: step.rule, message: step.message });
  }

  const remainingIssues = checkSvgSafety(text);
  return { sanitized: text, removed, clean: remainingIssues.length === 0 };
}
