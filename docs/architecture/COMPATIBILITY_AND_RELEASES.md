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

The first release has been cut, by explicit repository-owner authorization: tag
`theme-runtime-v0.1.0` on commit `d1c876bc5b8ac784c801da450976386bc42d68a9`, GitHub Release
["FDraft Theme Runtime
v0.1.0"](https://github.com/Burrichen/FDraft-Studio/releases/tag/theme-runtime-v0.1.0), both
packages at `0.1.0`. Full evidence (checksums, verification steps, exact FDraft-side values to
pin) is in `docs/IMPLEMENTATION_STATUS.md`'s "Release: `theme-runtime-v0.1.0`" section — this
section instead records what differs from the per-package plan originally documented above:

- **One combined tag/release, not two.** The `release-theme-sdk.yml` / `release-theme-renderer.yml`
  workflows above describe firing on separate `theme-sdk-v<version>` / `theme-renderer-v<version>`
  tags. For this first release the repository owner explicitly asked for one `theme-runtime-v0.1.0`
  tag and one Release covering both packages together, as a single tested compatibility pair —
  reasonable for a first release where the SDK and renderer are versioned in lockstep and have
  never been consumed independently by anything outside this monorepo. The combined tag/release
  was assembled by manually replicating the existing workflows' own verify → pack → checksum →
  `gh release create` sequence (neither per-package workflow fires on a `theme-runtime-v*` tag, so
  neither actually ran). The two separate workflows are unchanged and remain available for a future
  release where the packages' versions diverge or need independent release cadence — at that point,
  use the per-package tags they're already wired for instead of extending the combined scheme.
- **pnpm consumer requirement, discovered during this release's pre-tag verification:**
  `@fdraft/theme-renderer`'s packed `package.json` pins its own dependency on
  `@fdraft/theme-sdk` as a bare semver (`"0.1.0"`), which pnpm resolves against the public npm
  registry by default — even when the consumer already declares `@fdraft/theme-sdk` as a
  top-level `file:`/URL dependency pointing at the correct tarball. A consuming project (FDraft
  included) must add an `overrides` entry to its own `pnpm-workspace.yaml` (not `package.json`'s
  `"pnpm"` field — pnpm 11 no longer reads that) redirecting `@fdraft/theme-sdk` to the same
  tarball/URL source it already declared at the top level:
  ```yaml
  overrides:
    "@fdraft/theme-sdk": "https://github.com/Burrichen/FDraft-Studio/releases/download/theme-runtime-v0.1.0/fdraft-theme-sdk-0.1.0.tgz"
  ```
  Verified against two independent fresh consumers, including one installing the actual
  published (downloaded, checksum-verified) Release assets rather than the locally packed ones.

## Release sequence

1. Validate schemas, migrations, packages, fixtures, and renderer parity in `FDraft-Studio`.
2. Version and release SDK and renderer together when their compatibility changes.
3. Record immutable artifact identifiers and checksums.
4. In a clean FDraft branch, update exact package versions.
5. Run FDraft contract, build, fallback, and preview tests.
6. Only then allow new theme capabilities to be used by official themes.

Breaking theme-format changes require a major format version or a tested migration. Unsupported future major versions fail with a useful message and leave FDraft on its normal interface.

