# FDraft Studio — Format and Compatibility (developer-facing)

Quick reference. The full mechanics — distribution method, exact-pin rule, rollback policy —
live in `docs/architecture/COMPATIBILITY_AND_RELEASES.md`; this doc doesn't repeat them, only
adds the parts that document didn't cover: a step-by-step promotion runbook is
`docs/guides/RELEASE_CHECKLIST.md`.

## Five independently-tracked versions

| Axis | Where it lives | Current |
| --- | --- | --- |
| Studio application | `apps/studio/package.json` | `0.1.0` |
| `@fdraft/theme-sdk` package | `packages/theme-sdk/package.json` | `0.1.0` |
| `@fdraft/theme-renderer` package | `packages/theme-renderer/package.json` | `0.1.0` |
| Project format (`.fdstudio`) | `packages/theme-sdk/src/schema/versions.ts` | `1.0.0` |
| Theme format (`.fdtheme`) | `packages/theme-sdk/src/schema/versions.ts` | `1.0.0` |

`SDK_RENDERER_CONTRACT_VERSION` (also in `versions.ts`) is the renderer-compatibility version
this SDK build declares — a compiled theme's `manifest.minRendererVersion` must be `<=` a
given renderer's own declared version for that renderer to load it.

## Schema changes

Every prior addition to `StudioProjectDocument`/`RuntimeThemeDocument` has been additive
(new optional/defaulted fields) — no format-version bump has been needed since `1.0.0`. If a
genuinely breaking change is ever required: bump `CURRENT_PROJECT_FORMAT_VERSION`/
`CURRENT_THEME_FORMAT_VERSION`, add a migration step to `packages/theme-sdk/src/migration/`
(the registry upgrades one version at a time; anything older than
`MIN_SUPPORTED_PROJECT_FORMAT_VERSION`/`MIN_SUPPORTED_THEME_FORMAT_VERSION` is rejected
outright, never silently guessed at), and regenerate `schemas/*.schema.json`
(`pnpm run generate:schemas`, checked for drift by `pnpm run check:schemas`).

## Compatibility checking

Both sides run the identical logic — never two interpretations of "compatible":

- **FDraft's own gate** (`src/infrastructure/theme-runtime/compatibility.ts`,
  `checkThemeCompatibility`): a loaded theme's `minRendererVersion`, `requiredComponentKeys`,
  and `capabilities` checked against what's actually installed/supported, before anything
  renders.
- **Studio's pre-publish check** (`apps/studio/src/publish/fdraftCompatibility.ts`,
  `checkProjectAgainstFDraft`): the *same* three checks, run against the *linked* FDraft
  checkout's real, committed `installed-versions.generated.ts`/`compatibility.ts` — so an
  incompatible publish is caught before it ever reaches FDraft, not just when FDraft later
  refuses to render it.

## Release artifacts

- SDK/renderer: immutable tarballs attached to a tagged GitHub Release (not a package
  registry — see `COMPATIBILITY_AND_RELEASES.md` for why), checksum-verified. Current:
  `theme-runtime-v0.1.0`.
- Studio (Windows installer): a separate tag namespace (`studio-v<version>`), built on a real
  `windows-latest` CI runner (cross-compiling from macOS is confirmed infeasible in this
  toolchain — see `release-studio-windows.yml`'s own comments). Not code-signed — no
  certificate is available; documented accurately, not silently omitted.
