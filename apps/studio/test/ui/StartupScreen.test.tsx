import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { StartupScreen } from "../../src/ui/startup/StartupScreen.js";
import { recordRecentProject } from "../../src/recent/recentProjects.js";
import { createMinimalProjectTemplate, saveProject } from "../../src/project/projectFile.js";
import { writeAutosave } from "../../src/recovery/recovery.js";

describe("StartupScreen", () => {
  it("creates a new project (defaulting to the Standard FDraft template) and transitions the session to ready", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir);
      renderWithApp(<StartupScreen />, context);

      const user = userEvent.setup();
      await user.type(screen.getByLabelText("New project name"), "My Event");
      await user.click(screen.getByRole("button", { name: "New Project" }));

      await waitFor(() => expect(context.session.getState().status).toBe("ready"));
      expect(context.session.getState().open?.project.metadata.name).toBe("My Event");
      expect(context.session.getState().open?.project.pages).toHaveLength(8);
    });
  });

  it("creating a project with the Blank template produces no pages", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir);
      renderWithApp(<StartupScreen />, context);

      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText("Starter template"), "Blank");
      await user.type(screen.getByLabelText("New project name"), "Empty Event");
      await user.click(screen.getByRole("button", { name: "New Project" }));

      await waitFor(() => expect(context.session.getState().status).toBe("ready"));
      expect(context.session.getState().open?.project.pages).toEqual([]);
    });
  });

  it("shows recent projects, flags a missing path, and opening removes-then-reopens correctly", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir);
      const realPath = join(dir, "real.fdstudio");
      await saveProject(context.platform, { kind: "file", path: realPath, project: createMinimalProjectTemplate("Real Project"), assets: {}, lastSavedAt: undefined }, "0.1.0-test");
      await recordRecentProject(context.platform, context.paths, { path: realPath, name: "Real Project", kind: "file", lastOpenedAt: 1 });
      await recordRecentProject(context.platform, context.paths, { path: join(dir, "gone.fdstudio"), name: "Gone Project", kind: "file", lastOpenedAt: 2 });

      renderWithApp(<StartupScreen />, context);

      await screen.findByText("Gone Project");
      expect(screen.getByText("Not found")).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /^Real Project/ }));

      await waitFor(() => expect(context.session.getState().status).toBe("ready"));
      expect(context.session.getState().open?.path).toBe(realPath);
    });
  });

  it("offers crash recovery and restores it as a dirty project", async () => {
    await withTempDir(async (dir) => {
      const context = await makeAppContext(dir);
      const path = join(dir, "event.fdstudio");
      const saved = await saveProject(context.platform, { kind: "file", path, project: createMinimalProjectTemplate("Event"), assets: {}, lastSavedAt: undefined }, "0.1.0-test");
      const edited = { ...saved, project: { ...saved.project, metadata: { ...saved.project.metadata, name: "Recovered!" } } };
      await writeAutosave(context.platform, context.paths, edited, "0.1.0-test");

      renderWithApp(<StartupScreen />, context);

      await screen.findByText("Recover unsaved work?");
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Recover" }));

      await waitFor(() => expect(context.session.getState().status).toBe("ready"));
      expect(context.session.getState().open?.project.metadata.name).toBe("Recovered!");
      expect(context.session.getState().dirty).toBe(true);
    });
  });

  it("imports a compiled .fdtheme via the Import Theme dialog", async () => {
    await withTempDir(async (dir) => {
      const { compileTheme } = await import("@fdraft/theme-sdk");
      const { packFdtheme } = await import("@fdraft/theme-sdk/packaging");
      const project = createMinimalProjectTemplate("Compiled");
      const bundle = compileTheme(project, {}, { minRendererVersion: "0.1.0" });
      const bytes = await packFdtheme(bundle);
      const themePath = join(dir, "theme.fdtheme");
      await (await import("node:fs/promises")).writeFile(themePath, bytes);

      const context = await makeAppContext(dir);
      context.dialogs.openFileQueue.push(themePath);
      renderWithApp(<StartupScreen />, context);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Import Theme…" }));

      await waitFor(() => expect(context.session.getState().status).toBe("ready"));
      expect(context.session.getState().importWarnings?.length).toBeGreaterThan(0);
    });
  });
});
