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

**Real evidence this actually works end to end** (Prompt 13, official event starter
projects — see `docs/IMPLEMENTATION_STATUS.md` row 13 for full detail):

| Event | Compatible today? | Real publish outcome |
| --- | --- | --- |
| Christmas | Yes (7 supported component keys only, no unsupported capability) | **Published for real** into `theme-projects/christmas/` + `src/theme-packs/christmas/theme.fdtheme`; confirmed rendering in FDraft's real dev-preview route against a real running `next dev` server |
| Halloween | No | Correctly **blocked**: unsupported component keys (7 of 14 the default template places) + the `behaviour` capability its Candy Bowl needs; FDraft's real dev-preview route shows the incompatible-theme message cleanly, zero console errors |
| January | No | Correctly **blocked**: the `effects` capability its rain/clouds/fog needs (only reason — its page structure uses the same 7 supported keys as Christmas); same clean dev-preview fallback |

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

## E. Windows installer readiness (current, honest state)

- [ ] `apps/studio/src-tauri/tauri.conf.json` has correct `publisher`/`copyright`/`category`/
      `shortDescription`/Windows `nsis.installMode` before tagging.
- [ ] `studio-v<version>` tag matches `apps/studio/package.json`'s version exactly.
- [ ] **Not code-signed** — no Authenticode certificate exists for this project. A fresh
      install will show a SmartScreen "unknown publisher" warning. This is expected; do not
      claim a signed release anywhere in release notes.
- [ ] Actually running `release-studio-windows.yml` (which requires pushing the tag) and
      verifying the resulting installer on a real Windows machine has **not** been done as of
      this checklist's last update — the workflow is written and reasoned through against
      FDraft's own proven, identical pattern, but "does it actually produce a working
      installer" is confirmed only by running it.
