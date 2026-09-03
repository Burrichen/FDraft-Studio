# Release-candidate evidence

Machine-readable output from the real CI runs that built and tested a Windows
release candidate — kept in the repository so a claim about a candidate can be
checked against the artefact that produced it, rather than trusted. Content is
exactly as the runs emitted it; only line endings are normalised to LF by this
repository's `.gitattributes` (which exists because of the very CRLF bug row 17
records).

The installers themselves are **not** committed here (they are build outputs,
not source). They live as GitHub Actions build artifacts on the run recorded in
each manifest, and — once published — as GitHub Release assets.

## `studio-0.1.0-rc-*` — commit `dfc893e`

| File | What it is |
| --- | --- |
| `studio-0.1.0-rc-manifest.json` | Build/compatibility manifest emitted by the run, describing the exact installer that was tested |
| `studio-0.1.0-rc-SHA256SUMS.txt` | SHA-256 of that installer |
| `studio-0.1.0-rc-windows-smoke.json` | Result of every Windows install/launch/uninstall check, as recorded by the run |

Produced by workflow run
[33786939789](https://github.com/Burrichen/FDraft-Studio/actions/runs/33786939789)
on a `windows-latest` (Windows Server 2022, x64) runner from commit
`dfc893e2d193e53fd87a0f112180dcc790b10ac7`.

The installer's SHA-256 (`5dbcf4b7c301d6fc56d6221a07b97976ad38030d6880c5cd4720504011c17420`)
was additionally re-verified after downloading the artifact, so the recorded
checksum is known to describe the bytes that were actually distributed by that
run — not just the bytes the build machine had in hand.

**Not yet covered by this evidence:** any human, interactive GUI verification
(tutorial walkthrough, canvas editing, export, FDraft interop) and any test
against a real Windows FDraft build — hence
`testedFdraftVersion`/`testedFdraftCommit` are `null` in the manifest. See
`docs/guides/RELEASE_CHECKLIST.md` section G for that outstanding gate.

## `studio-0.1.0-rc2-*` — commit `05dfdd5`

The candidate produced by the **hardened** release workflow (Prompt 16), i.e. the plumbing
that would actually publish. Produced by run
[33790899131](https://github.com/Burrichen/FDraft-Studio/actions/runs/33790899131):
installer SHA-256 `152dbef6ce2f2a7b44b18e0ba371e655946292c83a0b644bf3bb40fb914ebc25`,
2,364,286 bytes.

Differences from `rc` above, all of them verification improvements:

- `release-manifest.json` carries the full Prompt 16 field set, including `tag` (`null` here,
  because a `workflow_dispatch` run has no tag and therefore *cannot* publish — the `publish`
  job was correctly **skipped**), `workflowRunId`, and the separated
  `minCompatibleFdraftCommit` / `lastVerifiedFdraftCommit` / `testedFdraftPlatform` fields.
- `windows-smoke-suite.json` adds the **upgrade/repair** path (re-running the installer over
  an existing install: exits 0, exactly one uninstall entry and one Start Menu shortcut, the
  executable retained, and a real probe file inside the install folder preserved) and proves
  user-data survival against **real files** written into app-data, rather than against a
  directory the application may never have created during a passive smoke launch.
- `SHA256SUMS.txt` is LF-terminated and verifies cleanly with `sha256sum -c` — the `rc` set's
  sidecar was CRLF-terminated, which GNU `sha256sum` rejects with `FAILED open or read`. That
  bug was found by downloading the artifact and actually running the check, and it would have
  failed the publish job's own checksum gate on every release.

## `studio-0.1.0-rc3-*` — commit `d686f5f` (current candidate)

**This is the candidate to test and release.** Produced by run
[33794749108](https://github.com/Burrichen/FDraft-Studio/actions/runs/33794749108):
installer SHA-256 `124b141b6752a180e27840f9a735a69ac8ab960b5dc370c9d5896f9e037a1098`,
2,367,054 bytes. All 20 Windows smoke checks pass, and `sha256sum -c` was confirmed against
the really-downloaded artifact.

What changed from `rc2`, and why the binary differs:

- **Publisher identity corrected.** It was `"FDraft Studio"` — a product name where a legal
  entity belongs — and is now `"Burrichen"`, matching FDraft's own convention and the
  `LICENSE` copyright holder. That is embedded in the binary, hence a new checksum. The smoke
  suite now asserts `Publisher` against the real identity **and** asserts `DisplayName`
  separately, since `DisplayName` ("FDraft Studio" vs FDraft's "FDraft (Beta)") is what
  actually distinguishes the two applications in Programs and Features.
- **Licence assets now ship with the release**: `LICENSE.txt` (MIT, © 2026 Burrichen) and the
  generated `THIRD_PARTY_NOTICES.md` covering 277 redistributed packages. The build fails if
  the notices file is absent.

### A correction this candidate's manifest carries

`studio-0.1.0-rc-manifest.json` (written by run 33786939789) records a single
`minCompatibleFdraftRef` of commit `006035c`, while
`docs/IMPLEMENTATION_STATUS.md` row 16 recorded `bed5426`. Both values are
correct but describe **different things**, and the manifest field conflated
them:

- `006035c` is the genuine **minimum** — the first FDraft commit supporting all
  14 default-template component keys plus `behaviour`/`effects`.
- `bed5426` is the **last commit actually verified against** (FDraft's current
  `feature/fdraft-theme-runtime` HEAD, where the official events were
  published).
- FDraft reports version `1.2.0-beta.9` at *both* commits, which is exactly why
  the SHA is the real pin and a version string alone cannot distinguish them.
- That branch is **unmerged** in FDraft.

The release workflow's manifest now emits `minCompatibleFdraftCommit`,
`minCompatibleFdraftVersion`, `lastVerifiedFdraftCommit` and
`testedFdraftPlatform` as separate fields so the distinction cannot be lost
again. The committed candidate manifest above is left exactly as the run
produced it — it is evidence, not a document to retouch.
