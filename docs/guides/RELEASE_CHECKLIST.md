# FDraft Studio — Release Checklist

The step-by-step this repo didn't have before: one connected runbook for promoting a
change across both repositories, not three cross-referenced documents to infer the missing
steps from. Each step names the exact command/file; the *why* behind the mechanics lives in
`docs/architecture/COMPATIBILITY_AND_RELEASES.md`.

## Before touching anything

- [ ] `git status` clean in both `FDraft-Studio` and the linked `FDraft` checkout.
- [ ] Confirm which repository owns the change: SDK/renderer (this repo, `packages/`),
      Studio itself (this repo, `apps/studio/`), or FDraft's own integration
      (`../FDraft/src/infrastructure/theme-runtime/` and neighbors) — a schema/behavior
      change to the shared contract touches at least two of these in sequence, never in
      parallel.

## A. Releasing a new `@fdraft/theme-sdk` / `@fdraft/theme-renderer` version

1. Make the change. If it touches the schema, confirm it's additive (no format-version bump)
   or add a real migration step (`packages/theme-sdk/src/migration/`) plus a version bump.
2. `pnpm run check:schemas` (drift check) if the schema changed.
3. Full gate: `pnpm run check:architecture && pnpm run check:boundaries && pnpm run lint`,
   then `typecheck`/`test`/`build` for the affected package(s).
4. Bump the package's own `version` in its `package.json`. Commit.
5. Push `main`. Push the tag (`theme-sdk-v<version>` / `theme-renderer-v<version>` /
   `theme-runtime-v<version>` for a combined release — see
   `COMPATIBILITY_AND_RELEASES.md`'s "Current status" for when a combined tag is
   appropriate). The tag must point at the exact tested, pushed commit.
6. CI (`release-theme-sdk.yml`/`release-theme-renderer.yml`) verifies the tag matches the
   version, runs the gate again, packs, checksums, and publishes the GitHub Release. Confirm
   it went green.
7. **Pre-tag checklist** (do this before step 5 if cutting manually rather than trusting CI
   alone): both packages' versions match exactly what's tagged; internal dependencies
   resolve to exact versions in the packed output (never `workspace:`/`file:`/`latest`);
   inspect both `.tgz` contents (runtime files + type declarations + manifest only — no dev
   fixtures, no source tree); install the packed tarballs into a fresh, out-of-workspace
   consumer and run a real smoke test; confirm deleting the original tarball location doesn't
   break the installed consumer; produce SHA-256 checksums; produce/update the compatibility
   manifest.

## B. Pinning the new version in FDraft

1. In a clean FDraft branch: update `package.json`'s `@fdraft/theme-sdk`/
   `@fdraft/theme-renderer` entries to the new release's exact tarball URL.
2. Add/update the matching `overrides` entry in `pnpm-workspace.yaml` if
   `@fdraft/theme-renderer`'s own nested `@fdraft/theme-sdk` dependency needs it (bare-semver
   nested dependency resolution gotcha — see `COMPATIBILITY_AND_RELEASES.md`).
3. `pnpm install`. Run FDraft's own `sync-theme-runtime-versions` script if
   `installed-versions.generated.ts` needs regenerating.
4. Before adding the new version to the lockfile, independently re-verify the downloaded
   tarball's checksum against the one FDraft-Studio's release recorded — never trust the
   package manager's own integrity check alone for a cross-repository pin.
5. Run FDraft's real contract/build/fallback/preview tests (not just "it installs").
6. Only after all of the above passes does the new capability become available for an
   official theme to actually use.

## C. Publishing a theme (from Studio, not a manual file copy)

Use Studio's own **Link FDraft Repo** → **Publish to FDraft** workflow — it runs the
identical compatibility check as step B.5 automatically, stages a diff, and requires
explicit confirmation before writing anything. Manual file copying bypasses all of this and
is not the supported path.

**Real evidence this actually works end to end** — updated as of the redo-dogfooding pass
against FDraft's now-complete compatibility contract (`docs/IMPLEMENTATION_STATUS.md` row 15;
superseding row 13's earlier, honest partial-compatibility snapshot):

| Event | Compatible today? | Real publish outcome |
| --- | --- | --- |
| Halloween | Yes — all 14 default-template component keys + `behaviour` | **Published for real** into `theme-projects/halloween/` + `src/theme-packs/halloween/theme.fdtheme`; Candy Bowl confirmed changing state at exact progress boundaries against FDraft's real dev-preview route |
| Christmas | Yes — migrated off its temporary 7-key structure onto the full 14-key template | **Published for real** into `theme-projects/christmas/` + `src/theme-packs/christmas/theme.fdtheme`, same visual appearance preserved |
| January | Yes — all 14 keys + `effects` | **Published for real** into `theme-projects/f-you-it-s-january/` + `src/theme-packs/f-you-it-s-january/theme.fdtheme`; real rain/clouds/fog confirmed present at high performance tier and correctly absent at low tier |

All three: zero console errors against a real running FDraft `next dev` server, no
compatibility exceptions, no reduced/custom structure.

## D. Rolling back

- **A bad SDK/renderer release**: never edit or force-move the existing tag. Cut a new patch
  tag with the fix and repoint FDraft's dependency URL at it (step B). Optionally mark the
  bad release as deprecated/pre-release on GitHub — the asset itself stays, since something
  may still reference it.
- **A bad Studio publish into FDraft**: reopen **Publish to FDraft** in Studio and use **Undo
  this publish** (one generation of backup is always kept). This restores
  `theme-projects/<slug>/`/`src/theme-packs/<slug>/` on disk; if the bad publish was already
  committed in FDraft, that still needs an ordinary `git revert` there — Studio never commits.
- **A bad Studio Windows installer release**: the tag/release are immutable like the SDK/
  renderer case — cut a new `studio-v<version>` tag with the fix.

## E. Windows installer readiness — verified on real Windows

Superseding this section's earlier "written but never run" state. A real Windows installer
has now been built and machine-verified. Evidence:
`docs/releases/candidates/studio-0.1.0-rc-*` (committed verbatim from the run).

**Done, with evidence:**

- [x] `apps/studio/src-tauri/tauri.conf.json` carries a distinct product identity —
      `productName` "FDraft Studio", `identifier` `com.fdraftstudio.app` (FDraft's own is
      `com.burrichen.fdraft`, so Windows derives entirely separate app-data/config/cache
      directories automatically), executable `fdraft-studio.exe` (FDraft's is `fdraft.exe`),
      `publisher`/`copyright`/`category`/`shortDescription` set, and NSIS
      `installMode: "currentUser"` — no administrator prompt.
- [x] `bundle.targets` narrowed from `"all"` to `["nsis"]`. No `.msi` is produced: a second
      installer format that nothing has verified is worse than one that is verified.
- [x] Icon is a genuine multi-resolution `.ico` (16/24/32/48/64/256 px, 32-bit) and is not a
      copy of FDraft's (confirmed by SHA-256 comparison). Tauri's NSIS bundler reuses it for
      the installer, executable, and uninstaller.
- [x] The application version is identical across `apps/studio/package.json`,
      `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, and the release workflow now
      **fails** if those three — or the pushed tag — ever disagree.
- [x] Real NSIS installer built on `windows-latest`:
      `FDraft-Studio-0.1.0-Windows-x64-Setup.exe`, 2,364,401 bytes, SHA-256
      `5dbcf4b7c301d6fc56d6221a07b97976ad38030d6880c5cd4720504011c17420` — checksum
      re-verified after download, so it describes the distributed bytes, not just the build
      machine's copy.
- [x] Windows smoke suite passed on the packaged application: silent install exits 0;
      uninstall registry entry created with the correct `DisplayVersion` (0.1.0) and
      `Publisher` ("FDraft Studio", not FDraft); `InstallLocation` reported; installed
      executable present; Start Menu shortcut created; the installed app launches and stays
      running (no immediate crash); silent uninstall exits 0; registry entry, executable and
      shortcut all removed; app-data preserved.
- [x] **Not code-signed** — no Authenticode certificate exists for this project. A fresh
      install shows a SmartScreen "unknown publisher" warning. Documented accurately in
      `docs/guides/WINDOWS_INSTALL.md` and the release notes, never worked around by telling
      users to disable Windows Security. No signing secret is referenced by any workflow.
- [x] Cross-compilation is confirmed infeasible in this toolchain (the Rust `ring` crate
      needs a Windows C toolchain macOS cannot supply), so `windows-latest` is the only real
      build path — recorded in the workflow's own header rather than rediscovered.

**Windows-specific bugs this first real Windows run actually caught** (all fixed; each was a
genuine defect, not CI noise — see `docs/IMPLEMENTATION_STATUS.md` for detail):

- No `.gitattributes`, so `windows-latest`'s default `core.autocrlf=true` rewrote committed
  text fixtures to CRLF on checkout and broke content-hash manifest verification. A Windows
  contributor with Git for Windows' own default would have hit this identically.
- `spawnSync("npx", …)` never launched on Windows (a `.cmd` shim needs a shell).
- `joinPath` fell back to POSIX separators for bare relative segments on any host.
- `node_modules/.bin/tsx` spawned by literal path — POSIX-only shim.
- Two real test races (a fire-and-forget state write, and a focus-on-mount effect) that only
  a differently-scheduled runner exposed.
- **`simulationCoverage.test.tsx` was never actually hermetic** — it read real event artwork
  from the sibling `../FDraft` checkout, so ordinary Linux CI had been failing on every commit
  since `b4fd8cb` while local runs passed. Fixed with committed synthetic fixtures; CI is
  green again.

## F. Studio release-candidate readiness (unchanged behaviour + built-in tutorial)

Preparing a release-candidate *source state* — not cutting a tag, packaging an installer, or
publishing a release; see `docs/IMPLEMENTATION_STATUS.md`'s tutorial/release-candidate row for
the full evidence this section summarizes.

- [ ] Working tree is the exact committed, tested result of the official-event redo-dogfooding
      pass (row 15) plus the tutorial addition (row 16) — no unexplained changes.
- [ ] Application version (`apps/studio/package.json`, `src-tauri/tauri.conf.json`,
      `src-tauri/Cargo.toml`) is identical across all three files.
- [ ] `@fdraft/theme-sdk`/`@fdraft/theme-renderer` versions, and the theme-format/
      project-format versions they declare, are recorded accurately and unchanged from the
      already-released `theme-runtime-v0.1.0` — no shared-package change was needed for either
      the compatibility-gap closure or the tutorial.
- [ ] The committed lockfile (`pnpm-lock.yaml`) contains no `file:`/`link:` override pointing
      outside this workspace, and no floating/`latest` version for `@fdraft/theme-sdk`/
      `@fdraft/theme-renderer` (both stay pinned to the released tarball via `workspace:*`
      inside this monorepo — resolved to exact versions only when actually packed for release).
- [ ] All three official event projects (Halloween, Christmas, January) still compile,
      publish (against a synthetic, real-shaped FDraft fixture — see
      `test/starterEvents/simulationCoverage.test.tsx`), and render — a blocked publish fails
      the test suite, not merely a documented gap.
- [ ] The complete verification matrix (formatting/lint/typecheck/architecture/boundaries/
      SDK/renderer/Studio/tutorial/schema/migration/package-round-trip/renderer-parity/
      official-event/security/archive+SVG-safety/save-recovery/accessibility/Windows-path/
      performance/memory-leak) passes clean — see the tutorial/release-candidate
      `IMPLEMENTATION_STATUS.md` row for the exact commands and counts.
- [ ] Built-in tutorial: every step manually cross-checked against real, current UI labels
      (not aspirational ones); automated coverage for first-run, skip, completion persistence,
      restart, Back/Next, close/reopen, keyboard-only operation, visible focus, no timer-driven
      motion, small-window rendering, unsaved-work/project-state preservation, missing-asset
      resilience, and offline availability (no `fetch` ever called) all pass.
- [ ] No Studio source code appears in FDraft's real production bundle (re-confirmed unchanged
      from Prompt 12 — nothing in this phase touches FDraft). No FDraft application code is
      copied into Studio (the tutorial describes FDraft's real behaviour in its own words; it
      does not import or embed any FDraft source).
- [ ] No Git tag, GitHub Release, or installer was created by this phase.

## G. Publishing the Windows release on GitHub

The release workflow (`.github/workflows/release-studio-windows.yml`) is the only publish
path. It is least-privilege by construction: the workflow defaults to `contents: read`, the
`verify` and `build-windows` jobs are read-only, and **only** the `publish` job takes
`contents: write`. `publish` is additionally gated on `startsWith(github.ref, 'refs/tags/')`,
so the `workflow_dispatch` path can build and smoke-test a candidate but can never publish.
Every action is pinned to a commit SHA, dependencies install from the committed lockfile with
`--frozen-lockfile`, and the job refuses to overwrite an existing Release.

**How to publish, once the outstanding gate below is satisfied:**

1. Confirm the working tree is clean and `main` is at the exact commit whose installer was
   verified.
2. `git tag studio-v<version>` on that commit, then `git push origin studio-v<version>`.
   The workflow verifies the tag against all three in-repo version files before building.
3. The workflow builds, runs the full matrix plus the Windows smoke suite, re-verifies the
   artifact's SHA-256 *after* download (proving the published bytes are the tested bytes),
   confirms `release-manifest.json` names that exact artifact/tag/commit, and only then
   creates the Release as a **pre-release** with the installer, `SHA256SUMS.txt` and
   `release-manifest.json` attached.
4. Verify the *published* download by repeating the post-publication steps below. A green
   Actions run is not by itself proof that the published release works.

- [ ] **Outstanding gate — human clean-Windows verification.** Machine verification
      (install/launch/uninstall/reinstall, checksums, the full test matrix on Windows) is
      done and green. What is **not** done, and cannot be done from a headless CI runner or
      a macOS workstation, is the interactive pass: walking the built-in tutorial in the
      installed app, creating a project, opening each official starter project, importing an
      image, direct text editing, Copy Workspace, pop-up editing, save/reopen, recovery,
      responsive preview, event simulation, behaviours, effects, `.fdstudio` export/import,
      `.fdtheme` compilation, and rendering a real exported theme **in a compatible Windows
      FDraft build** (Halloween, Christmas and January), including incompatible-theme and
      corrupt-theme rejection and last-known-good fallback. No interactive Windows
      environment and no Windows FDraft build exist yet — FDraft's own release workflow has
      never been run — so `testedFdraftVersion`/`testedFdraftCommit` are `null` in the
      candidate manifest. Do not publish, and do not fill those fields, until a person has
      actually run this pass and recorded the results here.
- [ ] **No licence is declared anywhere in this repository** — no `LICENSE` file, and no
      `license` field in any `package.json`. For a public release that is a real gap: without
      a licence, downloaders have no granted rights, and "licence and third-party notices"
      cannot be attached because none exist. Choosing a licence is the owner's decision, not
      something a release process should invent. Resolve before publishing publicly.
- [ ] Release channel: **pre-release**, because the installer is unsigned and this is the
      first public compatibility trial. The workflow passes `--prerelease` so it is never
      marked "Latest". Do not switch to a stable channel merely to avoid documenting a
      limitation.
- [ ] After publishing: download the installer *from the Release page*, verify its SHA-256
      against the attached `SHA256SUMS.txt`, confirm `release-manifest.json` names the right
      tag and commit, install it on a clean Windows machine, launch it, open the tutorial,
      open an official starter project, export a theme, test that theme in the compatible
      FDraft build, uninstall, and confirm both your projects and FDraft are unaffected.
- [ ] Never delete, move or force-update a published tag or Release. Cut a new patch tag
      instead (see section D).
