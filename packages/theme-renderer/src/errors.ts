export type RendererErrorCode =
  | "UNKNOWN_LAYER_TYPE"
  | "MISSING_MASTER"
  | "CIRCULAR_MASTER_CHAIN"
  | "MISSING_PAGE"
  | "MISSING_POPUP"
  | "RENDER_FAILURE";

export class RendererError extends Error {
  readonly code: RendererErrorCode;

  constructor(code: RendererErrorCode, message: string) {
    super(message);
    this.name = "RendererError";
    this.code = code;
  }
}
