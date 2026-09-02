import { z } from "zod";

/**
 * Every referenceable object in a project or theme carries a stable UUID.
 * Layers, tokens, assets, pages, masters, conditions, etc. are always
 * referenced by this id, never by array position or name, so reordering or
 * renaming never breaks a reference.
 */
export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

/** Strict `major.minor.patch[-prerelease]` semantic version string. */
export const SEMVER_PATTERN =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export const SemVerSchema = z
  .string()
  .regex(SEMVER_PATTERN, "must be a strict major.minor.patch[-prerelease] version");
export type SemVer = z.infer<typeof SemVerSchema>;

/**
 * A path to an asset *inside* a project or theme package. Always
 * forward-slash separated and relative — never an absolute path, a
 * drive-letter path, a `..` traversal, or a remote URL. Enforced again,
 * independently, by the packaging security layer at archive-read time —
 * this schema check only rejects obviously-bad strings before that.
 */
export const RelativeAssetPathSchema = z
  .string()
  .min(1)
  .refine((value) => !value.includes("\\"), "must use forward slashes")
  .refine((value) => !value.startsWith("/"), "must not be an absolute path")
  .refine((value) => !/^[a-zA-Z]:/.test(value), "must not be a drive-letter path")
  .refine(
    (value) => !value.split("/").some((segment) => segment === ".." || segment === "."),
    "must not contain path traversal segments",
  )
  .refine(
    (value) => !/^[a-z]+:\/\//i.test(value) && !value.startsWith("//"),
    "must not be a URL",
  );
export type RelativeAssetPath = z.infer<typeof RelativeAssetPathSchema>;

/** Hex color, 6 or 8 digits (with alpha). */
export const HexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "must be a #RRGGBB or #RRGGBBAA hex color");
export type HexColor = z.infer<typeof HexColorSchema>;

export const UnitIntervalSchema = z.number().min(0).max(1);

export const Vector2Schema = z.strictObject({
  x: z.number(),
  y: z.number(),
});
export type Vector2 = z.infer<typeof Vector2Schema>;

export const RectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});
export type Rect = z.infer<typeof RectSchema>;

/**
 * The base design-space size every layer `Transform` is authored against
 * (absolute px, top-left origin). A renderer scales this canvas to fit an
 * actual viewport rather than interpreting layer coordinates literally.
 * Optional and defaulted (see `DEFAULT_CANVAS_SIZE`) so it can be added
 * without a project-format version bump — every project authored before
 * this field existed is still valid, just implicitly at the default size.
 */
export const CanvasSizeSchema = z.strictObject({
  width: z.number().positive(),
  height: z.number().positive(),
});
export type CanvasSize = z.infer<typeof CanvasSizeSchema>;

export const DEFAULT_CANVAS_SIZE: CanvasSize = { width: 1920, height: 1080 };

/** SHA-256 hash, lowercase hex. */
export const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, "must be a lowercase hex sha256 digest");
