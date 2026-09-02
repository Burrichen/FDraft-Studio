import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";

async function readyContext(dir: string) {
  const context = await makeAppContext(dir);
  context.session.newProject("Asset Workspace Test");
  const path = join(dir, "event.fdstudio");
  await context.session.saveAs(path, "file");
  return context;
}

describe("AssetWorkspace", () => {
  it("imports a file via the file dialog and shows it in the grid", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      const sourcePath = join(dir, "Poster.png");
      await writeFile(sourcePath, Buffer.from("fake-png-bytes-for-testing"));
      context.dialogs.openFilesQueue = [[sourcePath]];

      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Assets" }));
      await user.click(screen.getByRole("button", { name: "Import…" }));

      await waitFor(() => expect(context.session.getState().open?.project.assets).toHaveLength(1));
      expect(screen.getByText("Poster.png")).toBeInTheDocument();
      expect(context.session.getState().canUndo).toBe(true);
    });
  });

  it("rejects an unsafe SVG at import time and shows the error instead of adding it", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      const sourcePath = join(dir, "bad.svg");
      // No <svg> root at all — sanitizeSvg cannot repair this, so planAssetImport must reject it outright.
      await writeFile(sourcePath, `<not-svg><script>alert(1)</script></not-svg>`);
      context.dialogs.openFilesQueue = [[sourcePath]];

      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Assets" }));
      await user.click(screen.getByRole("button", { name: "Import…" }));

      await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      expect(screen.getByRole("alert").textContent).toContain("bad.svg");
      expect(context.session.getState().open?.project.assets).toHaveLength(0);
    });
  });

  it("deletes an asset from the detail panel and undo restores it", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      const sourcePath = join(dir, "logo.png");
      await writeFile(sourcePath, Buffer.from("logo-bytes"));
      context.dialogs.openFilesQueue = [[sourcePath]];
      context.dialogs.confirmQueue = [true];

      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Assets" }));
      await user.click(screen.getByRole("button", { name: "Import…" }));
      await waitFor(() => expect(context.session.getState().open?.project.assets).toHaveLength(1));

      await user.click(screen.getByRole("button", { name: /logo\.png/ }));
      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(context.session.getState().open?.project.assets).toHaveLength(0));
      context.session.undo();
      expect(context.session.getState().open?.project.assets).toHaveLength(1);
    });
  });

  it("exports a real .fdtheme file through the export dialog", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      const destPath = join(dir, "event.fdtheme");
      context.dialogs.saveFileQueue = [destPath];

      renderWithApp(<StudioShell />, context);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Assets" }));
      await user.click(screen.getByRole("button", { name: "Export theme…" }));

      const exportButton = await screen.findByRole("button", { name: "Choose location and export" });
      await waitFor(() => expect(exportButton).toBeEnabled());
      await user.click(exportButton);

      await waitFor(() => expect(screen.getByText(new RegExp(`Exported to`))).toBeInTheDocument());

      const written = await context.platform.readFile(destPath);
      expect(written.byteLength).toBeGreaterThan(0);
    });
  });
});
