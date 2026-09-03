# FDraft Studio — Windows installation

FDraft Studio is **Windows-only**. There is no macOS or Linux build, and none
is planned in this release. Everything below describes the real, current
installer — not a future one.

## System requirements

| Requirement | Detail |
| --- | --- |
| Operating system | Windows 10 (version 1803 or later) or Windows 11 |
| Architecture | **x64 only** — no 32-bit (x86) or Arm64 build is produced |
| Runtime | Microsoft Edge WebView2 Runtime (already present on current Windows 10/11) |
| Disk space | Under 100 MB |
| Privileges | **None** — Studio installs per-user, with no administrator prompt |
| Network | Not required to run Studio. Needed only if WebView2 is missing and the installer has to fetch it |

## Which installer to download

One file, from the [GitHub Releases
page](https://github.com/Burrichen/FDraft-Studio/releases):

```
FDraft-Studio-<version>-Windows-x64-Setup.exe
```

That is the whole application. There is no `.msi`, no portable `.zip`, and no
separate runtime package to install first — a second installer format was
deliberately not produced, because a format nobody has verified is worse than
no format at all.

GitHub also attaches automatically generated **Source code** archives to every
release. Those are the repository's source, not the application. Do not
download them expecting a working Studio.

## Verify the download first

The installer is **not code-signed** (see below), so its checksum is the real
integrity check. Download `SHA256SUMS.txt` from the same release and compare:

```powershell
Get-FileHash .\FDraft-Studio-0.1.0-Windows-x64-Setup.exe -Algorithm SHA256
```

The `Hash` value should match the line in `SHA256SUMS.txt`, ignoring case. The
release also attaches `release-manifest.json`, which records the same checksum
alongside the exact source commit, tag, and CI workflow run that built it — so
you can confirm the file you have is the file that was tested.

If the checksum does not match, delete the download and fetch it again. Never
run an installer whose checksum you could not verify.

## Installation steps

1. Verify the checksum, as above.
2. Double-click `FDraft-Studio-<version>-Windows-x64-Setup.exe`.
3. Windows SmartScreen will warn about an unknown publisher — see the next
   section. Choose **More info → Run anyway** if you are satisfied with the
   checksum.
4. Follow the installer. It installs for the current user only, so there is no
   "Do you want to allow this app to make changes" administrator prompt.
5. A Start Menu entry named **FDraft Studio** is created (verified
   automatically on every release build).
6. Launch **FDraft Studio** from the Start Menu.

## Signing and SmartScreen — the honest position

**The installer is not code-signed.** There is no Authenticode code-signing
certificate for this project, so Windows has no publisher identity to verify
and will say so.

What you will actually see on a fresh machine:

- SmartScreen: *"Windows protected your PC"* / *"Publisher: Unknown"*.
- Possibly a browser warning that the file is "not commonly downloaded".

Both are consequences of the missing signature, not detections of anything
wrong with the file. The SHA-256 checksum is the appropriate verification.

**Do not turn off Windows Security, SmartScreen, Defender, or your antivirus
to install this.** It is never necessary, it weakens protection for everything
else on the machine, and any instruction telling you to do so — from anyone —
should be treated as a red flag.

## First launch and the built-in tutorial

On first launch Studio offers its built-in tutorial once. You can take it or
choose **Skip for Now**; skipping costs you nothing and is remembered.

The tutorial is always available afterwards from the **Help** button — present
both on the Startup Screen and inside an open project. It is fully offline
(bundled in the application, no internet needed), covers the real current
interface across 18 short steps, and includes a **What FDraft Studio Cannot
Change** section explaining which behaviour belongs to FDraft rather than to a
theme. **Restart Tutorial** returns to the first step at any time. Opening or
closing the tutorial never touches your project or your unsaved changes.

## Where your projects are stored

**You choose.** Studio saves a project as a single `.fdstudio` file wherever
you point **Save As** — Documents, OneDrive, a network share, anywhere you can
write. Studio does not hide your projects inside its own install directory or
its application data.

Studio keeps only small, per-user application state of its own:

```
%APPDATA%\com.fdraftstudio.app\
```

That holds the recent-projects list, tutorial completion state, and the
autosave/recovery slot — not your saved projects. It is Studio's own
namespace; FDraft uses a completely separate one (`com.burrichen.fdraft`), so
the two applications never share or overwrite each other's data.

Autosave writes to a recovery slot that is always separate from your real
saved file, so accepting a recovery offer never overwrites the last file you
explicitly saved.

## Backing up your projects

Because a project is a single self-contained `.fdstudio` file with its images
embedded by content hash, backing up is ordinary file copying:

1. Copy your `.fdstudio` files anywhere you keep backups.
2. That's it — there are no sidecar files, no asset folders to keep alongside,
   and no dependency on the machine that created them. Deleting the original
   images you imported does not break the project.

For point-in-time checkpoints while working, use Studio's own **snapshots**
(named, restorable as a new version) in addition to file-level backups.

## Updating

There is **no automatic updater** in this build. To update:

1. Download the newer installer from the Releases page.
2. Verify its checksum.
3. Run it. It installs over the previous version in place.

Your projects live outside the install directory (see above), so updating does
not touch them. Studio's own per-user state in `%APPDATA%` is likewise
preserved.

## Uninstalling

Use **Settings → Apps → Installed apps → FDraft Studio → Uninstall**, or the
Start Menu's uninstall entry.

Uninstalling:

- removes the application and its Start Menu shortcut;
- **does not delete your `.fdstudio` project files** — they were never inside
  the install directory;
- **does not delete** `%APPDATA%\com.fdraftstudio.app\`. The installer has no
  delete-application-data option at all, verified against the exact Tauri
  bundler version this project pins. Remove that folder by hand if you also
  want to clear recent-projects/tutorial state;
- **does not affect FDraft.** Studio and FDraft are separate applications with
  separate install locations, separate data namespaces, and separate uninstall
  entries. Uninstalling one never removes the other.

## Reporting a problem

Open an issue on the [repository](https://github.com/Burrichen/FDraft-Studio/issues)
with:

- your Windows version and build;
- the Studio version (the version in the installer filename you ran, or the
  `DisplayVersion` shown for FDraft Studio in Settings → Apps → Installed
  apps);
- what you did, what you expected, and what happened.

Studio's diagnostics deliberately exclude your project's content by default —
they describe the failure, not your artwork or copy. If a problem needs a
project file to reproduce, attach it only if you are willing to share that
content.

## Known limitations on Windows

- Unsigned installer, so SmartScreen warns on first run.
- No automatic updates.
- No `.fdstudio`/`.fdtheme` file associations — double-clicking a project file
  will not open Studio. Use **Open** inside the application. The associations
  were omitted deliberately rather than shipped partially working.
- Verified on a Windows Server 2022 x64 CI runner; other Windows versions are
  not yet covered by automated verification.
- Long paths: Studio checks a prospective path against Windows' classic
  260-character limit *before* writing, so you get a clear message rather than
  a partial write — but it does not enable long-path support for you. Prefer
  shorter project names in deeply nested folders.
