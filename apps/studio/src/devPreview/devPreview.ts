import { analyzeThemeExport, type ExportAnalysis } from "../project/exportAnalysis.js";
import { exportRuntimeTheme, type OpenProject, type RuntimeThemeExportOptions } from "../project/projectFile.js";
import type { FilePlatform } from "../platform/types.js";

export type DevPreviewStatus = "invalid" | "ready" | "error";

export interface DevPreviewResult {
  status: DevPreviewStatus;
  tempPath: string;
  analysis?: ExportAnalysis;
  errorMessage?: string;
}

/**
 * The one local, Studio-managed path a project's dev preview theme lives
 * at — never the user's own chosen project location, and never inside the
 * repository. Keyed by the project's own stable id (not its display name,
 * which can change and isn't filesystem-safe as typed) so re-opening the
 * same project always reconnects to the same file FDraft's dev preview
 * route may already be watching.
 */
export async function devPreviewTempPath(platform: FilePlatform, projectId: string): Promise<string> {
  const dir = platform.join(await platform.appDataDir(), "dev-preview");
  await platform.mkdir(dir);
  return platform.join(dir, `${projectId}.fdtheme`);
}

/**
 * Compiles and validates the current project exactly like a real Export
 * would (`analyzeThemeExport` — the same pre-flight check `ExportDialog`
 * runs), then either writes a fresh temp `.fdtheme` or, if the project
 * doesn't currently validate, deliberately leaves whatever was already on
 * disk untouched — "preserve the last valid preview if the current edit
 * does not validate" means never overwriting a good file with a broken
 * compile attempt.
 */
export async function buildDevPreview(platform: FilePlatform, open: OpenProject, options: RuntimeThemeExportOptions): Promise<DevPreviewResult> {
  const tempPath = await devPreviewTempPath(platform, open.project.metadata.id);
  const analysis = await analyzeThemeExport(open.project, open.assets, options);
  if (!analysis.valid) {
    return { status: "invalid", tempPath, analysis };
  }
  try {
    await exportRuntimeTheme(platform, open, tempPath, options);
    return { status: "ready", tempPath, analysis };
  } catch (error) {
    return { status: "error", tempPath, errorMessage: error instanceof Error ? error.message : String(error) };
  }
}

/** Removes this project's temp dev-preview file, if any — called on disconnect and on unmount so a closed/abandoned preview session doesn't leave files behind indefinitely. */
export async function cleanupDevPreview(platform: FilePlatform, projectId: string): Promise<void> {
  const tempPath = await devPreviewTempPath(platform, projectId);
  if (await platform.exists(tempPath)) await platform.remove(tempPath);
}

/**
 * A plain outbound HTTP probe — never a listener Studio itself opens, so
 * this can never be reached from beyond the local machine no matter what
 * `baseUrl` is typed in. Any real HTTP response (even a 404/500) means
 * *something* is listening, which is all "connected" needs to mean here;
 * only a network-level failure (nothing listening, wrong port, DNS
 * failure) counts as disconnected.
 */
export async function checkFDraftReachable(baseUrl: string, fetchImpl: typeof fetch = fetch, timeoutMs = 2000): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetchImpl(baseUrl, { method: "GET", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
