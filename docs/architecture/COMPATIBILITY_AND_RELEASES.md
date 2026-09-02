# Compatibility and releases

## Separate versions

Track these independently:

- Studio application version;
- `@fdraft/theme-sdk` package version;
- `@fdraft/theme-renderer` package version;
- theme format version;
- project format version.

A `.fdtheme` manifest declares its format version, minimum compatible renderer version, required component keys, capability flags, and file hashes.

## Exact dependency rule

FDraft must pin exact SDK and renderer versions in its manifest and lockfile. Do not use `latest`, wildcard ranges, floating Git branches, or a committed `file:../FDraft-Studio` dependency.

During early local development, an uncommitted sibling override may be used if it is documented and cannot enter a commit accidentally. Release and CI verification must use the same exact artifacts that FDraft will consume.

## Distribution choices

**Decision (Prompt 2): immutable package tarballs attached to a tagged GitHub Release, verified by checksum — not a package registry.**

Inspected facts that drove this (see `docs/architecture/BASELINE_AUDIT.md` for the raw findings):

- `Burrichen/FDraft-Studio` and `Burrichen/FDraft` are both **public** GitHub repositories (confirmed via the unauthenticated `api.github.com/repos/...` response — private repos 404 unauthenticated; both returned 200 with `"private": false"`).
- Neither repo has an npm org, a configured private registry, or any registry credentials set up anywhere in either checkout.
- FDraft's own CI (`FDraft/.github/workflows/*.yml`) runs on GitHub-hosted `windows-latest` runners with only the default `GITHUB_TOKEN` — no npm publish token exists for it to consume a registry package, and adding one is exactly the kind of "silently require credentials FDraft CI doesn't have" this document warns against.
- A public repo's GitHub Release assets are plain HTTPS downloads with no authentication required, which works identically for a local developer and for CI.

Given that, a registry release would need new infrastructure (an npm org, a token secreted into two repos' CI) to solve a problem release-tarball-by-URL already solves for free. The tarball route was chosen.

### How it works

1. `packages/theme-sdk/package.json`'s version is bumped and committed (still pre-1.0: see below).
2. A human pushes a tag `theme-sdk-v<version>` (e.g. `theme-sdk-v0.1.0`) — **not automated**, and not something this repository's tooling does on its own.
3. `.github/workflows/release-theme-sdk.yml` fires on that tag: verifies the tag matches `package.json`'s version, runs the full gate (architecture check, typecheck, tests, build, schema-drift check), runs `pnpm pack` to produce `fdraft-theme-sdk-<version>.tgz`, computes its sha256 into a sidecar `.sha256` file, and publishes both as assets on a GitHub Release named after the tag — using only the workflow's default `GITHUB_TOKEN` (no secret to provision).
4. FDraft pins the exact release asset URL as its dependency:
   ```json
   "@fdraft/theme-sdk": "https://github.com/Burrichen/FDraft-Studio/releases/download/theme-sdk-v0.1.0/fdraft-theme-sdk-0.1.0.tgz"
   ```
   npm/pnpm can install directly from a tarball URL; the resulting lockfile records its own integrity hash from that exact download, so any later tampering with the URL's content (which GitHub Releases don't permit in place anyway) would be caught on the next install.
5. Before adding a new version to FDraft's lockfile, a maintainer downloads both the `.tgz` and `.tgz.sha256` from the release page and runs `sha256sum -c fdraft-theme-sdk-<version>.tgz.sha256` to cross-verify the artifact matches what CI built, independent of npm's own integrity check.

`@fdraft/theme-renderer` (`.github/workflows/release-theme-renderer.yml`, tag `theme-renderer-v<version>`) follows the identical route. Its workflow runs `pnpm pack` too — not `npm pack` — specifically because pnpm rewrites the package's `"@fdraft/theme-sdk": "workspace:*"` dependency to the exact resolved version at pack time (verified: packing today produces `"@fdraft/theme-sdk": "0.1.0"` in the published `package.json`, never the workspace protocol, which isn't resolvable outside this monorepo).

### Rollback

Releases and tags are immutable once published — never edit or force-move a `theme-sdk-v*`/`theme-renderer-v*` tag. To "roll back," publish a new patch tag with the fix and repoint FDraft's dependency URL at it. If a bad release must stop being offered, it can be marked as a pre-release/deprecated on GitHub, but the asset itself is not deleted while anything may still reference it.

### Current status

No tag has been pushed for either package yet — both release workflows are authored and their underlying operations tested (the CI gate, the pack/checksum steps, and every `pack`/`compile`/`verify` operation are exercised by each package's own test suite against real in-memory archives, and `pnpm pack` has been run manually to confirm the workspace-dependency rewrite) but **not executed as an actual release**, since cutting the first tag is a deliberate action for the repository owner, not something to do unprompted. See `docs/IMPLEMENTATION_STATUS.md`.

## Release sequence

1. Validate schemas, migrations, packages, fixtures, and renderer parity in `FDraft-Studio`.
2. Version and release SDK and renderer together when their compatibility changes.
3. Record immutable artifact identifiers and checksums.
4. In a clean FDraft branch, update exact package versions.
5. Run FDraft contract, build, fallback, and preview tests.
6. Only then allow new theme capabilities to be used by official themes.

Breaking theme-format changes require a major format version or a tested migration. Unsupported future major versions fail with a useful message and leave FDraft on its normal interface.

