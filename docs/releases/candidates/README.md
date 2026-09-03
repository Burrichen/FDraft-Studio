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
