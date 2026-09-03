/**
 * Pure-JS, dependency-free path helpers used by both `tauriPlatform.ts`
 * and the test platform. `node:path` isn't available in a Tauri webview,
 * and Tauri's own `@tauri-apps/api/path` join/dirname/basename are async
 * (they go through Rust IPC) — this keeps project-lifecycle logic
 * synchronous and testable on any OS, by detecting a path's separator
 * style from its own content rather than assuming the host OS's.
 */

/**
 * The running host's own separator, used only as a fallback when a path
 * segment carries no separator hint of its own (e.g. a bare relative
 * fragment like `"theme-projects"`) — a real bug found via Prompt 15's
 * first actual Windows CI run: that fallback used to be hardcoded to `/`
 * unconditionally, so joining plain segments on Windows silently produced
 * POSIX-style paths instead of native ones. `process` (real Node, both in
 * Vitest and in the Windows/macOS/Linux release-workflow runners) is
 * checked first since it's exact; `navigator` (a real webview's own OS,
 * accurate in production Tauri — unlike jsdom's test double, which is why
 * `process` is checked first) is the production fallback.
 */
function hostSeparator(): "\\" | "/" {
  if (typeof process !== "undefined" && typeof process.platform === "string") {
    return process.platform === "win32" ? "\\" : "/";
  }
  if (typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent ?? "")) {
    return "\\";
  }
  return "/";
}

function detectSeparator(path: string): "\\" | "/" {
  // A drive letter, a UNC prefix, or any backslash unambiguously implies
  // Windows-style; a leading "/" unambiguously implies POSIX (real Windows
  // paths never start that way) — both cases keep a path's own, already-
  // evident style regardless of host, e.g. a project saved on macOS and
  // later opened on Windows. Only a genuinely ambiguous bare fragment (no
  // separator hint at all, e.g. the literal string "theme-projects") falls
  // back to the running host's own separator.
  if (/^[a-zA-Z]:/.test(path) || path.includes("\\")) return "\\";
  if (path.startsWith("/")) return "/";
  return hostSeparator();
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

/**
 * Windows' legacy `MAX_PATH` limit — still the safe default without
 * per-application/system-wide opt-in long-path support enabled. Checked
 * proactively, on every host OS, before a write is attempted: a project
 * saved on macOS but later opened on a Windows machine (or a repository
 * cloned into a deeply-nested folder) should never silently produce a
 * path Windows itself can't open, and the failure should be a clear
 * message *before* any bytes are written, not a cryptic OS error after a
 * partial write.
 */
export const WINDOWS_MAX_PATH = 260;

export function exceedsWindowsMaxPath(path: string): boolean {
  return path.length >= WINDOWS_MAX_PATH;
}
