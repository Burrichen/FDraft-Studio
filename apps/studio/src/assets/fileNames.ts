/**
 * Windows reserves these device names, with or without an extension,
 * case-insensitively — a file literally named "CON.png" cannot exist on
 * an NTFS/Windows filesystem at all. Since assets are always stored under
 * a content-addressed path (never a path derived from the display name),
 * this only matters for the *display* name shown in the Asset Workspace —
 * but it still needs handling so a project someone else made on macOS
 * doesn't show an unopenable-looking name, and so nothing downstream
 * (export previews, "reveal in Finder"-style affordances) ever tries to
 * write a file using it literally.
 */
const WINDOWS_RESERVED_NAMES = new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]);

const MAX_DISPLAY_NAME_LENGTH = 200;

// Control characters, path separators, and the characters Windows forbids in a filename (: * ? " < > |).
const UNSAFE_NAME_CHARS = /[\x00-\x1F\x7F/\\:*?"<>|]/g;

function splitExt(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

/**
 * Normalises an imported filename into a safe, stable display name:
 * Unicode-normalised (NFC, so visually-identical names from different
 * source OSes compare equal), stripped of path separators/control
 * characters/Windows-illegal punctuation (spaces, hyphens, periods, and
 * ordinary Unicode text are all left alone), a Windows-reserved base name
 * disambiguated, trailing dots/spaces removed (also a Windows
 * restriction), and bounded to a sane length. Never touches the
 * content-addressed storage path — this is purely what a human sees.
 */
export function sanitizeDisplayFileName(rawName: string): string {
  let name = rawName.normalize("NFC").replace(UNSAFE_NAME_CHARS, "").trim();
  if (name.length === 0) name = "Untitled";

  const split = splitExt(name);
  const ext = split.ext;
  let base = split.base;
  base = base.replace(/[. ]+$/, ""); // trailing dots/spaces are stripped by Windows
  if (base.length === 0) base = "Untitled";

  if (WINDOWS_RESERVED_NAMES.has(base.toUpperCase())) base = `${base}_file`;

  const maxBaseLength = Math.max(1, MAX_DISPLAY_NAME_LENGTH - ext.length);
  if (base.length > maxBaseLength) base = base.slice(0, maxBaseLength);

  return `${base}${ext}`;
}

/**
 * Disambiguates a display name against the set of names already in use
 * (e.g. two different photos both literally named "logo.png") by
 * appending " (2)", " (3)", etc. before the extension. Never touches
 * `path`/`sha256` — this is purely a grid/list legibility concern, not a
 * storage concern, since storage is content-addressed and two
 * differently-named assets can never collide there.
 */
export function dedupeDisplayName(name: string, existingNames: ReadonlySet<string>): string {
  if (!existingNames.has(name)) return name;
  const { base, ext } = splitExt(name);
  let n = 2;
  let candidate = `${base} (${n})${ext}`;
  while (existingNames.has(candidate)) {
    n += 1;
    candidate = `${base} (${n})${ext}`;
  }
  return candidate;
}
