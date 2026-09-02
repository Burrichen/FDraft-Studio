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

Prompt 2 must inspect the actual GitHub ownership, repository visibility, package manager, and CI constraints before selecting one reproducible route:

1. a package registry release pinned by exact semantic version; or
2. immutable package tarballs attached to a signed/tagged release and verified by checksum.

The choice must work for both local developers and FDraft CI. Record setup, authentication, rollback, and release steps. Do not silently choose a private package registry that the FDraft build cannot access.

## Release sequence

1. Validate schemas, migrations, packages, fixtures, and renderer parity in `FDraft-Studio`.
2. Version and release SDK and renderer together when their compatibility changes.
3. Record immutable artifact identifiers and checksums.
4. In a clean FDraft branch, update exact package versions.
5. Run FDraft contract, build, fallback, and preview tests.
6. Only then allow new theme capabilities to be used by official themes.

Breaking theme-format changes require a major format version or a tested migration. Unsupported future major versions fail with a useful message and leave FDraft on its normal interface.

