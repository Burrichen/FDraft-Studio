import type { ComponentCopySlotDeclaration } from "./types.js";

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Substitutes only the placeholders a slot's own `allowedPlaceholders`
 * names — anything else is left as a literal `{{token}}` rather than
 * silently stripped, so an unresolved or disallowed placeholder stays
 * visible (and inspectable) instead of vanishing into blank text.
 */
export function substitutePlaceholders(text: string, allowedPlaceholders: string[] | undefined, values: Record<string, string> | undefined): string {
  if (!allowedPlaceholders || allowedPlaceholders.length === 0 || !values) return text;
  return text.replace(PLACEHOLDER_PATTERN, (match, name: string) => (allowedPlaceholders.includes(name) && values[name] !== undefined ? values[name] : match));
}

/**
 * Resolves the final text for every declared copy slot: the
 * theme-authored override if present and non-blank, else the adapter's
 * own approved default — "required action labels cannot be empty" is
 * enforced right here, not left to each adapter to remember — then
 * substitutes any allowed runtime placeholders.
 */
export function resolveComponentCopy(slots: ComponentCopySlotDeclaration[], overrides: Record<string, string> | undefined, placeholderValues: Record<string, string> | undefined): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const slot of slots) {
    const override = overrides?.[slot.key];
    // Untouched (undefined) always falls back to the default. A
    // *required* slot also falls back if the author left it blank —
    // "required action labels cannot be empty." An *optional* slot's
    // explicit empty string is respected as a deliberate "show nothing
    // here" rather than forced back to the default.
    const text = override === undefined || (slot.required && override.trim().length === 0) ? slot.defaultText : override;
    resolved[slot.key] = substitutePlaceholders(text, slot.allowedPlaceholders, placeholderValues);
  }
  return resolved;
}
