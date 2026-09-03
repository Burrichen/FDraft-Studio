# FDraft Studio 0.1.0 — Windows (beta)

The first public Windows build of FDraft Studio: a standalone desktop
application for designing FDraft themes and event pages visually, without
editing React, CSS, or FDraft application code.

**This is a pre-release.** The installer is not code-signed, and this is
Studio's first public compatibility trial against FDraft.

## Verification status — read this before you rely on it

Being straight about what has and has not been checked, because "the build is
green" and "a person has used this" are different claims.

**Verified automatically, on a real Windows x64 runner, for this exact
installer:** silent install with no administrator prompt; correct product name,
version and publisher in the registry; Start Menu shortcut created; **the
installed application launches and keeps running**; reinstall over an existing
install (no duplicate entries or shortcuts, files preserved); silent uninstall
removing the executable, registry entry and shortcut; and user data surviving
uninstall, proven against real files. Plus the full test suite — 806 tests
across the SDK, renderer and Studio — run on Windows, and the installer's
SHA-256 re-verified after download.

**Not yet verified: a human using the packaged application.** Nobody has yet
walked the tutorial, drawn on the canvas, imported an image, saved and reopened
a project, or exported a theme *from an installed copy on a real Windows
desktop*. Those features are covered by automated tests and were developed
against a running app, but the packaged Windows GUI itself has had a launch
smoke check and nothing more. High-DPI scaling, font metrics, native file
dialogs and clipboard behaviour are the likeliest places for something to be
wrong.

**Also not verified:** rendering an exported theme in a Windows FDraft build —
no Windows FDraft build exists yet. Theme rendering *was* verified against a
real running FDraft server (all three official events, zero console errors),
and FDraft renders through the same shared renderer package on every platform,
so the risk is low — but it is not the same as having done it on Windows.

That's what "beta" means here. If something is broken, please
[open an issue](https://github.com/Burrichen/FDraft-Studio/issues) — that is
genuinely useful, and it is the gap this release is asking you to help close.

## What this is (and what it isn't)

Studio edits **visual theme data only** — pages, pop-ups, master layers,
images, copy slots, presentational behaviour rules, and decorative effects,
saved as declarative data. It never generates React, CSS, HTML, or FDraft
source code.

**FDraft keeps all of its own business logic.** A theme cannot change event
dates or availability, joining or leaving an event, film eligibility, draft
generation, watched state, event progress, points or rewards, profile data,
destructive-action confirmations, safety-critical messages, or any
runtime-generated value. FDraft validates every theme against its own
supported component keys and capabilities before rendering, and falls back to
its ordinary interface if a theme is invalid or incompatible.

## Download

| File | Purpose |
| --- | --- |
| `FDraft-Studio-0.1.0-Windows-x64-Setup.exe` | The installer. This is the download you want. |
| `SHA256SUMS.txt` | Checksum for verifying the installer. |
| `release-manifest.json` | Machine-readable build/compatibility record. |
| `LICENSE.txt` | The MIT licence this software is released under. |
| `THIRD_PARTY_NOTICES.md` | Licences and copyright notices for the 277 third-party packages the installer redistributes. |

GitHub's automatically generated "Source code" archives are the repository
source, not the application — they are not a substitute for the installer.

## Requirements

- **Windows 10 (version 1803 or later) or Windows 11, x64.** No 32-bit or
  Arm64 build is produced.
- **Microsoft Edge WebView2 Runtime.** Present by default on current Windows
  10/11. If it is missing, the installer downloads it silently
  (Tauri's default `downloadBootstrapper` install mode), which needs an
  internet connection on that first install only. Studio itself never
  downloads or executes code at runtime.
- Under 100 MB of free disk space. The installer download is about 2.3 MB.
- No administrator rights required — Studio installs per-user.

There is **no macOS or Linux build.** Studio is Windows-only today.

## Versions in this build

| Component | Version |
| --- | --- |
| FDraft Studio application | 0.1.0 |
| `@fdraft/theme-sdk` | 0.1.0 |
| `@fdraft/theme-renderer` | 0.1.0 |
| Theme format (`.fdtheme`) | 1.0.0 (minimum supported: 1.0.0) |
| Project format (`.fdstudio`) | 1.0.0 (minimum supported: 0.9.0) |

**Compatible FDraft:**

- **Minimum:** FDraft commit `006035c` — the first FDraft commit whose theme
  runtime supports all 14 default-template component keys plus the
  `behaviour` and `effects` capabilities, pinned to this repository's
  `theme-runtime-v0.1.0` release.
- **Last verified against:** FDraft commit `bed5426`.
- Both commits report FDraft version `1.2.0-beta.9` — FDraft has no
  per-integration version of its own, so the commit SHA is the real pin.
- Both sit on FDraft's `feature/fdraft-theme-runtime` branch, which is **not
  yet merged into FDraft's default branch**. Theme support reaches ordinary
  FDraft users only once that branch lands.

Older FDraft builds correctly *reject* themes that use capabilities they lack,
rather than mis-rendering them, and fall back to FDraft's ordinary interface.

## What's included

- **Project lifecycle** — templates (Standard FDraft, Immersive, Minimal,
  Poster, Blank), atomic saves, autosave with crash recovery, named snapshots,
  undo/redo.
- **Design mode** — pan/zoom canvas, multi-select, rotation-aware resize and
  rotate, snapping and guides, grouping, z-order, crop and mask, direct
  on-canvas text editing, design tokens.
- **Structure** — pages, pop-ups, master layers with narrow per-page
  overrides and detach, a nested layers tree with lock/visibility, and
  protected FDraft components placed and styled within an allowed set.
- **Copy** — typed copy slots per component with `{{placeholder}}` tokens, and
  a Copy review pass that flags defaults, blanks, unresolved placeholders,
  missing accessible names, and measured text overflow.
- **Behaviour mode** — a no-code rule builder over a closed set of safe,
  read-only variables, with a rule trace explaining which rule won.
- **Effects** — bounded, procedural rain/clouds/fog and similar, with hard
  per-performance-tier caps and a static resting frame under reduced-motion.
- **Simulate mode** — saved scenarios for event status, progress, viewport,
  simulated date/time and placeholder values. Never the real clock, and never
  real profile data.
- **Assets** — drag/paste/pick import, copied into the project by content
  hash, SVG sanitisation, "where used" resolution and unused-asset detection.
- **Export and publish** — `.fdstudio` (editable source) and `.fdtheme`
  (compiled runtime) packages with pre-flight analysis, plus **Publish to
  FDraft**, which checks compatibility against a linked FDraft checkout's own
  real committed capabilities, shows an exact diff, and keeps one recoverable
  backup. It never runs Git for you.
- **Built-in tutorial** — 18 steps covering the real current interface,
  entirely offline, available at any time from the **Help** button. It offers
  itself once on first launch and can be dismissed with **Skip for Now**
  without affecting your work. Includes a "What FDraft Studio Cannot Change"
  section and links to the bundled User Guide and Troubleshooting docs.

## Verifying your download

PowerShell:

```powershell
Get-FileHash .\FDraft-Studio-0.1.0-Windows-x64-Setup.exe -Algorithm SHA256
```

Compare the result with the value in `SHA256SUMS.txt` (case-insensitive). On a
system with `sha256sum` available, `sha256sum -c SHA256SUMS.txt` works
directly. `release-manifest.json` records the same checksum alongside the exact
source commit and workflow run that produced it.

## Signing and SmartScreen

**This installer is not code-signed.** No Authenticode certificate exists for
this project, so Windows has no publisher identity to check.

Expect Windows SmartScreen to warn that the publisher is unknown, or "Windows
protected your PC", the first time you run it. That warning is about the
*absence of a signature*, not evidence of a problem. If you choose to
continue, use **More info → Run anyway** after verifying the SHA-256 checksum
above.

**Do not disable Windows Security, SmartScreen, or your antivirus.** That is
never necessary to install this, and the checksum is the appropriate check.

## Known limitations

- **Unsigned installer**, so a SmartScreen warning appears on first run (see
  above). This is the main reason this release is labelled beta.
- **No automatic updates.** There is no updater in this build; new versions
  are downloaded from this Releases page manually.
- **Windows x64 only.** No macOS, Linux, 32-bit, or Arm64 build.
- **No `.fdstudio`/`.fdtheme` file associations.** Double-clicking a project
  file will not open Studio; use **Open** inside the application. The
  associations were deliberately omitted rather than shipped half-working.
- **Official event artwork is incomplete.** The "F* You, It's January!" starter
  project has no real artwork at all — its missing imagery is represented by
  clearly-labelled empty asset slots, with the mood built from design tokens
  and procedural effects. The Christmas artwork is FDraft's own
  placeholder-quality scaffold set, not final creative. Only the Halloween set
  is real, approved artwork.
- **One component copy slot is not yet wired end-to-end.** `draft-controls`'
  `skipLabel`/`confirmLabel` overrides are editable in Studio but not yet
  applied to the real button text by FDraft's host adapter.
- **`animations` capability is not declared by FDraft yet**, so a theme using
  animations will be correctly rejected by FDraft rather than rendered.
- **Verification scope.** This build's automated verification ran on a Windows
  Server 2022 x64 runner. Other Windows versions are untested.

## Reporting a problem

Open an issue on this repository. Include your Windows version, the Studio
version (0.1.0), what you did, and what happened. Studio's diagnostics export
deliberately excludes your project content by default — please attach a
project file only if you are willing to share it.

## Licence

FDraft Studio is released under the **MIT licence** (© 2026 Burrichen) — see
`LICENSE.txt`, attached to this release and in the repository root.

The installer also redistributes compiled forms of 277 third-party packages
(9 JavaScript, 268 Rust crates). Their licences and copyright notices are in
the attached `THIRD_PARTY_NOTICES.md`, generated from real dependency metadata
and filtered to the Windows target, so it describes what actually ships rather
than the union of every platform.

## Repository documentation

- [User Guide](https://github.com/Burrichen/FDraft-Studio/blob/main/docs/guides/USER_GUIDE.md)
- [Troubleshooting](https://github.com/Burrichen/FDraft-Studio/blob/main/docs/guides/TROUBLESHOOTING.md)
- [Windows installation guide](https://github.com/Burrichen/FDraft-Studio/blob/main/docs/guides/WINDOWS_INSTALL.md)
- [Release checklist](https://github.com/Burrichen/FDraft-Studio/blob/main/docs/guides/RELEASE_CHECKLIST.md)
