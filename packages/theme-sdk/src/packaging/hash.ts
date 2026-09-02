/**
 * Uses the standard Web Crypto `crypto.subtle.digest` rather than
 * `node:crypto` — available as a global in Node 20+, and in every modern
 * browser engine including Tauri's webview (WKWebView/WebView2), which is
 * exactly why this is async: `SubtleCrypto` has no synchronous API. This
 * is what makes `@fdraft/theme-sdk/packaging` usable directly from
 * Studio's frontend, not just from Node/CLI contexts.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
