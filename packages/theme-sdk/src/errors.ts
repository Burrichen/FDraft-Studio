export type SdkErrorCode =
  | "SCHEMA_VALIDATION_FAILED"
  | "UNSUPPORTED_FUTURE_VERSION"
  | "UNSUPPORTED_LEGACY_VERSION"
  | "MIGRATION_NOT_FOUND"
  | "DUPLICATE_ID"
  | "BROKEN_REFERENCE"
  | "DISALLOWED_STYLE_PROPERTY"
  | "CIRCULAR_MASTER"
  | "BEHAVIOUR_TYPE_MISMATCH"
  | "BEHAVIOUR_UNSAFE_ACTION"
  | "BEHAVIOUR_SELF_TRIGGER_LOOP"
  | "MISSING_ASSET"
  | "ASSET_HASH_MISMATCH"
  | "ZIP_PATH_TRAVERSAL"
  | "ARCHIVE_TOO_LARGE"
  | "ARCHIVE_TOO_MANY_FILES"
  | "FILE_TOO_LARGE"
  | "COMPRESSION_RATIO_EXCEEDED"
  | "DANGEROUS_FILE_TYPE"
  | "EXTERNAL_URL_NOT_ALLOWED"
  | "UNSAFE_SVG"
  | "INVALID_PACKAGE_FORMAT"
  | "MANIFEST_HASH_MISMATCH"
  | "RENDERER_INCOMPATIBLE";

export interface SdkErrorOptions {
  code: SdkErrorCode;
  message: string;
  /** JSON path or archive-relative path the error concerns, if any. */
  path?: string;
  details?: unknown;
  cause?: unknown;
}

/**
 * Every failure the SDK raises deliberately (as opposed to an unexpected
 * bug) is an `SdkError` with a stable `code`, so callers — the Studio UI,
 * FDraft's fallback logic, CI scripts — can branch on `code` rather than
 * parsing `message` strings.
 */
export class SdkError extends Error {
  readonly code: SdkErrorCode;
  readonly path?: string;
  readonly details?: unknown;

  constructor(options: SdkErrorOptions) {
    super(options.message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "SdkError";
    this.code = options.code;
    if (options.path !== undefined) this.path = options.path;
    this.details = options.details;
  }
}

export function isSdkError(value: unknown): value is SdkError {
  return value instanceof SdkError;
}
