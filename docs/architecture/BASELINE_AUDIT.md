# Baseline audit — Prompt 1

Recorded 2026-09-02. This is a point-in-time snapshot, not a living document. Re-verify
before relying on any fact here in a later phase.

## Studio starting ref

- Repository: `FDraft-Studio`, root `/Users/isaac/Projects/FDraft-Studio`.
- Remote: `https://github.com/Burrichen/FDraft-Studio.git` (origin), branch `main`, tracking
  `origin/main`, working tree clean at commit `ee7f777` ("chore: establish FDraft Studio
  foundation") before this phase's changes.
- No tags exist yet.
- GitHub visibility: **public** (confirmed via unauthenticated `api.github.com/repos/...`
  returning `"private": false"`, `"visibility": "public"`). `gh` CLI is not installed
  locally, so this could not be cross-checked against authenticated org/CI settings —
  team/CI access, branch protection, and Actions billing status remain unknown.

## Sibling FDraft path and known-good-base candidates

- Sibling checkout confirmed at `../FDraft` (`/Users/isaac/Projects/FDraft`), remote
  `https://github.com/Burrichen/FDraft.git`, also **public**.
- Sibling working tree is clean but **currently checked out on `feat/dev-build1-event-studio`**
  — this is the failed Event Studio branch itself, not a neutral state. Nothing in this
  phase modified it.
- Branch `feat/dev-build1-event-studio` is 9 commits ahead of `main` and 0 behind; merge
  base is `8bc5af7` (`v1.2.0-beta.9`). `main` itself is at `v1.2.0-beta.9`
  (`package.json` version `1.2.0-beta.9` via `git show main:package.json`, read-only).
- **Known-good-base candidate: `main` (`v1.2.0-beta.9`)**, pending user confirmation. The
  event-studio branch's own commit history documents its instability directly (sample
  messages: "revert deadlocking Promise.all in Studio Save", "temporary CI diagnostics for
  Save-persists Windows CI failure", "widen Save-persists test timeout for Windows CI
  variance").
- Other local branches present, not otherwise inspected: `feat/exe2`, `feat/execonversaion`,
  `feat/update1`, `v104`, `v110`, `v111`, `v112`, `v113`.
- Tags run `v1.0.0`…`v1.1.3`, then a `v1.2.0-beta.1`…`v1.2.0-beta.9` prerelease track, then
  a separate `v1.2.0-dev.*` track used only by the dev-build/Event-Studio CI pipeline
  (`.github/workflows/release-studio.yml`, triggered on `v*-dev.*` tags, Windows-only,
  distinct from the `beta.X` counter `release.yml` uses).

## Sibling FDraft package/runtime facts (read-only)

- Package manager: pnpm, pinned `packageManager: "pnpm@11.21.0"`; workspace defined via its
  own `pnpm-workspace.yaml`/`pnpm-lock.yaml`.
- Framework: Next.js 16.3.0, React 19.2.8 / React DOM 19.2.8, TypeScript ^5, Tailwind CSS
  ^4, Zod ^4.4.3, Vitest ^4 (unit), Playwright ^1.62 (e2e), ESLint 9 + Prettier 3.
- Desktop shell: Tauri — `@tauri-apps/cli` ^2.11.4, Rust crate `tauri = "2.11.3"`,
  `tauri-build = "2.6.3"`, Rust edition 2021, `rust-version = "1.77.2"`. Two Tauri configs
  exist side by side: `src-tauri/tauri.conf.json` (product `"FDraft (Beta)"`, identifier
  `com.burrichen.fdraft`) and `src-tauri/tauri.studio.conf.json` (the separate Event Studio
  desktop identity), each with its own `pnpm run *:dev` / `*:build` script pair.
- Build commands (root `package.json`): `dev`/`build`/`start` (Next.js),
  `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e` (`playwright test`),
  `lint`, `format:check`, `desktop:dev`/`desktop:build` (real app), `studio:dev`/
  `studio:build` (Event Studio dev build).
- CI: `.github/workflows/release.yml` (real Beta releases) and `release-studio.yml`
  (Event Studio dev builds, Windows-only, gated on `pnpm format:check && lint && typecheck
  && test` before packaging).

## Event/theme architecture — candidate only, not verified

The branch has an extensive existing domain model under `src/domain/events/`,
`src/application/events/`, and `src/components/events/` (eligibility, availability, opt-in,
draft finalization, decoration slots, art packs, manifest schema, etc.), separate from the
Event Studio editor itself (`src/domain/event-studio/`, `src/application/event-studio/`,
`theme-editor/` components, `.fdraft-theme` schema in `src/domain/event-themes/`).

Per this repository's boundary rules, **none of this was copied, and none of it is treated
as verified**. It is recorded here only as a pointer to where FDraft's existing event logic
and tests live, marked **candidate until independently verified** should a later prompt
need to design `@fdraft/theme-sdk`'s contract to interoperate with FDraft's real event
domain. The failed editor code (`event-studio`, `theme-editor`, `studio-*` stores) must not
be used as a starting point for `apps/studio` per `CLAUDE.md`.

## Baseline commands run in FDraft-Studio (this phase)

| Command | Result |
| --- | --- |
| `node scripts/check-architecture.mjs` | Pass — "FDraft Studio architecture scaffold is present." |
| `pnpm install --frozen-lockfile` | Succeeded trivially (no dependencies declared anywhere yet); the resulting empty lockfile and `node_modules/` were removed afterward — see "Scaffold gaps fixed" below. Re-run once Prompt 2 adds real package manifests. |

No FDraft build/test commands were run — the sibling repository was inspected read-only
only (`git status`, `git log`, `git show <ref>:path`, `find`, file reads); nothing there was
executed, installed, or built.

## Scaffold gaps fixed in this phase

The delivered scaffold had two gaps against this prompt's own requirements
("root CLAUDE.md, README, ignore rules, editor settings, and minimal workspace
configuration"):

- No `.gitignore` existed, and `.DS_Store` had been committed by mistake. Added a
  `.gitignore` (`node_modules/`, build output, Tauri `target/`, env files, OS/editor
  cruft, test artifacts, and a `.local/` convention for uncommitted sibling-link
  overrides) and untracked the stray `.DS_Store`.
- No editor settings existed. Added minimal `.vscode/settings.json` and
  `.vscode/extensions.json` (ESLint, Prettier, Tauri, rust-analyzer, EditorConfig) —
  matching the Tauri + React + TypeScript stack `apps/studio/README.md` already commits to
  for Prompt 4.

No other scaffold content was changed. Everything else (architecture docs, package
directory READMEs, `check-architecture.mjs`, workspace config) matched the prompt's
requirements and was left as-is.

## Repository visibility / package-distribution unknowns

Carried forward from `docs/IMPLEMENTATION_STATUS.md`, now partially resolved:

- **Resolved this phase:** both `FDraft-Studio` and `FDraft` are public GitHub repositories.
  This rules out one failure mode (a private package registry FDraft's CI can't reach) but
  does not by itself select a distribution route.
- **Still unresolved, blocking Prompt 2's release-route decision:**
  - Whether package releases should go through a public registry (npm, GitHub Packages) or
    immutable release-tag tarballs with checksums (both are valid per
    `COMPATIBILITY_AND_RELEASES.md`; no `.npmrc` or registry config exists in either repo
    today).
  - Actual GitHub Actions / CI status for `FDraft-Studio` (no workflows exist there yet;
    `FDraft` has two, both assuming pnpm + Node 22 + Rust stable on `windows-latest`).
  - Confirmation that `main` (`v1.2.0-beta.9`) — not `feat/dev-build1-event-studio` or one
    of the untriaged `v1*` branches — is the intended known-good base for eventual FDraft
    integration (Prompt 10+).

## What must not be carried forward

- Any code, tests, or store implementations from `feat/dev-build1-event-studio`'s
  `event-studio` / `theme-editor` / `studio-*` work — referenced above as location pointers
  only, never copied, never a design template for `apps/studio`, `theme-sdk`, or
  `theme-renderer`.
- The `v1.2.0-dev.*` tag/CI track — it is specific to the failed Event Studio dev-build
  pipeline in FDraft and has no equivalent meaning in FDraft-Studio's own release process.
- The empty `pnpm-lock.yaml` / `node_modules/` generated by this phase's validation
  `pnpm install` — removed before finishing; Prompt 2 will produce the real lockfile once
  `@fdraft/theme-sdk` has actual dependencies.
