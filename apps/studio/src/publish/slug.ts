/**
 * Lowercase, hyphen-separated, filesystem-safe — the only shape ever
 * allowed as a directory name under `theme-projects/`/`src/theme-packs/`.
 * Never derived from anything the user can point at an escaping path
 * with — any character outside `[a-z0-9]` collapses to a single hyphen.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "untitled";
}

/**
 * Defense in depth: even a slug that already passed through `slugify` is
 * re-checked immediately before it's ever joined into a filesystem path —
 * a slug can never contain a path separator, `..`, a drive letter, or
 * anything else that could resolve outside its intended parent directory.
 * `StudioPlatform.join` performs no traversal normalization of its own
 * (confirmed: it faithfully concatenates whatever segments it's given),
 * so this check is the only thing standing between a hostile/corrupted
 * project name and a path-traversal write.
 */
export function isPathSafeSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}
