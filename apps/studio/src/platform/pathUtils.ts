/**
 * Pure-JS, dependency-free path helpers used by both `tauriPlatform.ts`
 * and the test platform. `node:path` isn't available in a Tauri webview,
 * and Tauri's own `@tauri-apps/api/path` join/dirname/basename are async
 * (they go through Rust IPC) — this keeps project-lifecycle logic
 * synchronous and testable on any OS, by detecting a path's separator
 * style from its own content rather than assuming the host OS's.
 */

function detectSeparator(path: string): "\\" | "/" {
  // A drive letter or any backslash implies Windows-style; otherwise POSIX.
  return /^[a-zA-Z]:/.test(path) || path.includes("\\") ? "\\" : "/";
}

/** Splits off a leading drive letter ("C:\") / UNC root ("\\\\") / POSIX root ("/"), returning it plus the remainder. */
function splitRoot(path: string, sep: "\\" | "/"): { prefix: string; rest: string } {
  const driveMatch = /^([a-zA-Z]:)[\\/]?(.*)$/.exec(path);
  if (driveMatch) return { prefix: `${driveMatch[1]}${sep}`, rest: driveMatch[2] ?? "" };
  if (path.startsWith("\\\\")) return { prefix: "\\\\", rest: path.slice(2) };
  if (/^[\\/]/.test(path)) return { prefix: sep, rest: path.slice(1) };
  return { prefix: "", rest: path };
}

function splitSegments(path: string): string[] {
  return path.split(/[\\/]+/).filter((segment) => segment.length > 0);
}

export function joinPath(...segments: string[]): string {
  const nonEmpty = segments.filter((s) => s.length > 0);
  if (nonEmpty.length === 0) return "";
  const sep = detectSeparator(nonEmpty[0]!);
  const { prefix, rest } = splitRoot(nonEmpty[0]!, sep);
  const parts = [rest, ...nonEmpty.slice(1)].flatMap(splitSegments);
  return prefix + parts.join(sep);
}

export function dirnamePath(path: string): string {
  const sep = detectSeparator(path);
  const { prefix, rest } = splitRoot(path, sep);
  const parts = splitSegments(rest);
  if (parts.length <= 1) return prefix || sep;
  return prefix + parts.slice(0, -1).join(sep);
}

export function basenamePath(path: string): string {
  const parts = splitSegments(path);
  return parts.at(-1) ?? "";
}

/** Basename with a trailing extension (matched case-insensitively) removed. */
export function stemName(path: string, extension: string): string {
  const base = basenamePath(path);
  return base.toLowerCase().endsWith(extension.toLowerCase()) ? base.slice(0, base.length - extension.length) : base;
}
