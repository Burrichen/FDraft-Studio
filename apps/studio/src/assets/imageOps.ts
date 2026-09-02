/**
 * Browser/webview-only image helpers (`createImageBitmap`,
 * `OffscreenCanvas`) — deliberately not exercised by the node-environment
 * unit test suite, the same way `Canvas.tsx`'s DOM-dependent gesture code
 * isn't either. Verified visually instead (see the Asset Workspace's
 * dimension display and optimise-preview).
 */

export async function measureImageDimensions(bytes: Uint8Array, mimeType: string): Promise<{ width: number; height: number } | undefined> {
  try {
    const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
    const bitmap = await createImageBitmap(blob);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return undefined;
  }
}

export type OptimizableMimeType = "image/png" | "image/jpeg" | "image/webp";

/**
 * Re-encodes a raster image client-side (no new dependency — the
 * webview's own Canvas/image-codec support does the work) at a given
 * quality. Never touches the *original* bytes/asset id — the caller
 * applies the result through `buildReplaceAssetSourceCommand`, so the
 * operation is undoable (that's what "non-destructive" means here, same
 * as every other edit in Studio) rather than requiring two copies to be
 * kept forever. SVG and font assets are out of scope — there's nothing
 * to re-encode.
 */
export async function reencodeImage(bytes: Uint8Array, sourceMimeType: string, targetType: OptimizableMimeType, quality: number): Promise<Uint8Array> {
  const blob = new Blob([new Uint8Array(bytes)], { type: sourceMimeType });
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.drawImage(bitmap, 0, 0);
    const outBlob = await canvas.convertToBlob({ type: targetType, quality: targetType === "image/png" ? undefined : quality });
    return new Uint8Array(await outBlob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}
