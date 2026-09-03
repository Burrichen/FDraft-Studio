import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withTempDir } from "../helpers/tempDir.js";
import { makeAppContext, renderWithApp } from "../helpers/renderApp.js";
import { NodeTestDialogs } from "../helpers/nodePlatform.js";
import { StudioShell } from "../../src/ui/shell/StudioShell.js";
import { openProjectFromPath } from "../../src/project/projectFile.js";

async function readyContext(dir: string) {
  const context = await makeAppContext(dir);
  context.session.newProject("Shell Test Event");
  const path = join(dir, "event.fdstudio");
  await context.session.saveAs(path, "file");
  return context;
}

describe("StudioShell", () => {
  it("renders the command bar, panels, and central stage for an open project", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Pages and layers" })).toBeInTheDocument();
      expect(screen.getByRole("complementary", { name: "Properties" })).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Editor mode" })).toBeInTheDocument();
      expect(screen.getAllByText("Shell Test Event").length).toBeGreaterThan(0);
    });
  });

  it("collapses side panels without touching the central stage", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Toggle Pages and Layers panel" }));
      expect(screen.queryByRole("navigation", { name: "Pages and layers" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Toggle Properties panel" }));
      expect(screen.queryByRole("complementary", { name: "Properties" })).not.toBeInTheDocument();
    });
  });

  it("Preview mode hides every editor control", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Preview" }));

      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Pages and layers" })).not.toBeInTheDocument();
      expect(screen.queryByRole("complementary", { name: "Properties" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Exit Preview" })).toBeInTheDocument();
    });
  });

  it("Preview mode cycles viewport profiles, wrapping around, without leaking any control into the render target", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Preview" }));

      const cycler = screen.getByRole("group", { name: "Viewport profile" });
      expect(cycler).toHaveTextContent("Desktop (1920px)");

      await user.click(screen.getByRole("button", { name: "Next viewport profile" }));
      expect(cycler).toHaveTextContent("Laptop (1366px)");
      await user.click(screen.getByRole("button", { name: "Next viewport profile" }));
      expect(cycler).toHaveTextContent("Mobile (390px)");
      await user.click(screen.getByRole("button", { name: "Next viewport profile" }));
      expect(cycler).toHaveTextContent("Desktop (1920px)");

      await user.click(screen.getByRole("button", { name: "Previous viewport profile" }));
      expect(cycler).toHaveTextContent("Mobile (390px)");

      // The cycler and "Exit Preview" live in the bar, not inside the rendered stage.
      const stage = document.querySelector(".shell-center-preview");
      expect(stage?.querySelector('[aria-label="Next viewport profile"]')).toBeNull();
      expect(stage?.querySelector('button')).toBeNull();
    });
  });

  it("Assets mode replaces the Design layout with the Asset Workspace, and switching back restores it", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Assets" }));

      expect(screen.queryByRole("navigation", { name: "Pages and layers" })).not.toBeInTheDocument();
      expect(screen.queryByRole("complementary", { name: "Properties" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Import…" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Folders" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Design" }));
      expect(screen.getByRole("navigation", { name: "Pages and layers" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Import…" })).not.toBeInTheDocument();
    });
  });

  it("Simulate mode replaces the Design layout with the Simulation panel and a live preview", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Simulate" }));

      expect(screen.queryByRole("navigation", { name: "Pages and layers" })).not.toBeInTheDocument();
      expect(screen.queryByRole("complementary", { name: "Properties" })).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Scenarios" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "+ Save current as new scenario" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show trace" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Design" }));
      expect(screen.getByRole("navigation", { name: "Pages and layers" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Scenarios" })).not.toBeInTheDocument();
    });
  });

  it("Copy review opens as a modal over Design mode, scans without crashing, and closes", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Open copy review" }));

      expect(screen.getByRole("dialog", { name: "Copy review" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Scan for clipped text" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Scan for clipped text" }));
      expect(screen.getByRole("dialog", { name: "Copy review" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog", { name: "Copy review" })).not.toBeInTheDocument();
    });
  });

  it("editing the project name in the Properties panel is undoable and saves", async () => {
    await withTempDir(async (dir) => {
      const context = await readyContext(dir);
      renderWithApp(<StudioShell />, context);

      const user = userEvent.setup();
      const nameInput = screen.getByLabelText("Name");
      await user.clear(nameInput);
      await user.type(nameInput, "Renamed Event");
      await user.tab(); // blur

      await waitFor(() => expect(context.session.getState().dirty).toBe(true));
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(context.session.getState().dirty).toBe(false));

      const reopened = await openProjectFromPath(context.platform, context.session.getState().open!.path);
      expect(reopened.project.metadata.name).toBe("Renamed Event");
    });
  });

  describe("Preview in FDraft", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("builds a temp preview theme on open, reports connection status, and offers the path/URL to copy", async () => {
      await withTempDir(async (dir) => {
        const context = await readyContext(dir);
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);
        const writeText = vi.fn().mockResolvedValue(undefined);

        renderWithApp(<StudioShell />, context);
        const user = userEvent.setup();
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        await user.click(screen.getByRole("button", { name: "Preview in FDraft" }));

        expect(screen.getByRole("dialog", { name: "Preview in FDraft" })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText(/Preview theme is up to date/)).toBeInTheDocument());
        await waitFor(() => expect(screen.getByText(/Connected/)).toBeInTheDocument());
        expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000", expect.objectContaining({ method: "GET" }));

        const pathInput = screen.getByLabelText("Preview theme file path") as HTMLInputElement;
        expect(pathInput.value).toContain("dev-preview");
        expect(pathInput.value.endsWith(".fdtheme")).toBe(true);

        await user.click(screen.getByRole("button", { name: "Copy path" }));
        expect(writeText).toHaveBeenCalledWith(pathInput.value);

        await user.click(screen.getByRole("button", { name: "Close" }));
        expect(screen.queryByRole("dialog", { name: "Preview in FDraft" })).not.toBeInTheDocument();
      });
    });

    it("reports disconnected when nothing answers at the given URL", async () => {
      await withTempDir(async (dir) => {
        const context = await readyContext(dir);
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

        renderWithApp(<StudioShell />, context);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Preview in FDraft" }));

        await waitFor(() => expect(screen.getByText(/Not connected/)).toBeInTheDocument());
      });
    });
  });

  describe("Link and Publish to FDraft", () => {
    const VERSIONS_FILE = `export const INSTALLED_THEME_SDK_VERSION = "0.1.0";\nexport const INSTALLED_THEME_RENDERER_VERSION = "0.1.0";\n`;
    const COMPATIBILITY_FILE = `export const FDRAFT_SUPPORTED_COMPONENT_KEYS = [] as const;\nexport const FDRAFT_SUPPORTED_CAPABILITIES = [] as const;\n`;

    async function fdraftRepoContext(dir: string) {
      const dialogs = new NodeTestDialogs();
      const context = await makeAppContext(dir, dialogs);
      context.session.newProject("Publish Test Event");
      await context.session.saveAs(join(dir, "event.fdstudio"), "file");

      const repo = join(dir, "FDraft");
      await context.platform.mkdir(join(repo, "src", "app"));
      await context.platform.writeTextFile(join(repo, "package.json"), JSON.stringify({ name: "fdraft", dependencies: { "@fdraft/theme-sdk": "https://example.com/x.tgz" } }));
      const runtimeDir = join(repo, "src", "infrastructure", "theme-runtime");
      await context.platform.mkdir(runtimeDir);
      await context.platform.writeTextFile(join(runtimeDir, "installed-versions.generated.ts"), VERSIONS_FILE);
      await context.platform.writeTextFile(join(runtimeDir, "compatibility.ts"), COMPATIBILITY_FILE);

      return { context, repo };
    }

    it("shows 'not linked' first, links a repository, then plans and publishes with no blockers", async () => {
      await withTempDir(async (dir) => {
        const { context, repo } = await fdraftRepoContext(dir);
        renderWithApp(<StudioShell />, context);
        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: "Publish to FDraft" }));
        await waitFor(() => expect(screen.getByText(/No FDraft repository linked yet/)).toBeInTheDocument());

        await user.click(screen.getByRole("button", { name: "Link FDraft Repository…" }));
        expect(screen.getByRole("dialog", { name: "Link FDraft Repository" })).toBeInTheDocument();

        context.dialogs.openDirectoryQueue.push(repo);
        await user.click(screen.getByRole("button", { name: "Choose folder…" }));
        await waitFor(() => expect(screen.getByText(/plausible FDraft repository/)).toBeInTheDocument());
        await user.click(screen.getByRole("button", { name: "Link this folder" }));
        await waitFor(() => expect(screen.getByText(repo)).toBeInTheDocument());

        await user.click(screen.getAllByRole("button", { name: "Close" })[0]!);
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Link FDraft Repository" })).not.toBeInTheDocument());
        await user.click(screen.getByRole("button", { name: "Publish to FDraft" }));

        await waitFor(() => expect(screen.getByText(/theme-projects\/publish-test-event/)).toBeInTheDocument());
        expect(screen.queryByText("Blocked")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Confirm and Publish" }));
        await waitFor(() => expect(screen.getByText("Published.")).toBeInTheDocument());

        expect(await context.platform.exists(join(repo, "theme-projects", "publish-test-event", "project.json"))).toBe(true);
        expect(await context.platform.exists(join(repo, "src", "theme-packs", "publish-test-event", "theme.fdtheme"))).toBe(true);
      });
    });
  });
});
