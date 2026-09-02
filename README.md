# FDraft Studio

FDraft Studio is a standalone desktop application for visually designing FDraft themes and event pages without editing React, CSS, or FDraft application code.

This repository owns:

- the Studio desktop application;
- `@fdraft/theme-sdk`, the versioned theme contract and package tools;
- `@fdraft/theme-renderer`, the shared runtime renderer;
- schemas, fixtures, compatibility tests, and architecture documentation.

The existing FDraft application remains in its own repository. It consumes exact released versions of the SDK and renderer, supplies real component adapters and event data, and falls back safely when a theme is invalid.

## Start here

1. Read [CLAUDE.md](CLAUDE.md).
2. Read [the product contract](docs/architecture/PRODUCT_CONTRACT.md).
3. Read [the two-repository architecture](docs/architecture/TWO_REPOSITORY_ARCHITECTURE.md).
4. Read [compatibility and releases](docs/architecture/COMPATIBILITY_AND_RELEASES.md).
5. Read [the integration workflow](docs/architecture/INTEGRATION_WORKFLOW.md).
6. Follow [implementation status](docs/IMPLEMENTATION_STATUS.md).

Run `pnpm check:architecture` once pnpm is available. Prompt 1 in the supplied Claude Code prompt pack verifies this scaffold before application development begins.

## Working packages

- `packages/theme-sdk` — the versioned theme contract, validation, packaging, and CLI (Prompt 2). See its own README.
- `packages/theme-renderer` — the shared DOM renderer both Studio and FDraft will render through (Prompt 3). See its own README.
- `apps/renderer-lab` — a fixture lab that develops and visually proves the renderer independently of Studio and FDraft. Run `pnpm --filter @fdraft/renderer-lab dev`.
- `apps/studio` — the standalone Tauri + React desktop application (Prompt 4): project lifecycle, atomic saves, autosave/crash-recovery, snapshots, undo/redo. Run `pnpm --filter @fdraft/studio tauri:dev`. See its own README.

Useful root-level commands: `pnpm run lint`, `pnpm run check:boundaries` (no package imports across a repository/app boundary it shouldn't), `pnpm run check:schemas` (generated JSON Schema matches source), plus each package's own `typecheck`/`test`/`build`.

## Repository boundary

Keep the repositories beside one another during development:

```text
Projects/
  FDraft/
  FDraft-Studio/
```

Do not copy the FDraft application into this repository. Do not commit `file:../FDraft-Studio` dependencies into FDraft. Cross-repository production integration uses exact versioned packages or verified release artifacts.

