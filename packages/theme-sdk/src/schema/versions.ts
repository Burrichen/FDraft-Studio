/**
 * Format-version constants. These are independent of the `@fdraft/theme-sdk`
 * package version (see package.json) — the package version tracks the SDK's
 * own API/implementation, while these track the *data* contract that
 * projects and compiled themes are serialised against.
 */

/** Current editable Studio project format version. */
export const CURRENT_PROJECT_FORMAT_VERSION = "1.0.0";

/** Current compiled runtime theme format version. */
export const CURRENT_THEME_FORMAT_VERSION = "1.0.0";

/**
 * Oldest project format version the migration registry can still upgrade
 * to {@link CURRENT_PROJECT_FORMAT_VERSION}. Anything older is rejected as
 * an unsupported legacy version rather than silently guessed at.
 */
export const MIN_SUPPORTED_PROJECT_FORMAT_VERSION = "0.9.0";

/** Oldest theme format version the SDK can still read/verify. */
export const MIN_SUPPORTED_THEME_FORMAT_VERSION = "1.0.0";

/**
 * The renderer compatibility version this SDK build declares. A compiled
 * theme's `manifest.minRendererVersion` must be `<=` a given renderer's own
 * declared version for that renderer to load it.
 */
export const SDK_RENDERER_CONTRACT_VERSION = "0.1.0";
