# Windows verification pass — the hands-on gate before publishing

The one thing no CI runner can do. Everything machine-checkable is already
green (see `RELEASE_CHECKLIST.md` section E); this covers the part that needs a
person in front of a real Windows x64 machine.

**Budget ~40 minutes.** Work top to bottom and tick as you go. If something
fails, stop and record it — a failure here is exactly what this pass exists to
find, and publishing anyway would defeat the point.

Fill in the two lines at the bottom when you're done; those values go straight
into the release manifest.

---

## 0. Before you start (5 min)

1. Open the workflow run for the candidate you're testing on GitHub → Actions →
   **Release Studio (Windows installer)** → the run → **Artifacts** →
   `fdraft-studio-windows-0.1.0`. Download and unzip.
2. You should have: the `.exe`, `SHA256SUMS.txt`, `release-manifest.json`,
   `windows-smoke-suite.json`, `LICENSE.txt`, `THIRD_PARTY_NOTICES.md`.
3. **Verify the checksum before running anything:**

   ```powershell
   Get-FileHash .\FDraft-Studio-0.1.0-Windows-x64-Setup.exe -Algorithm SHA256
   Get-Content .\SHA256SUMS.txt
   ```

   - [ ] The two hashes match (case-insensitive). **If they don't, stop.**
   - [ ] `release-manifest.json`'s `commitSha` matches the commit you intend to
         release.

Record your Windows version now — `winver` in the Start menu.

## 1. Install (5 min)

| | Do this | Expect |
|---|---|---|
| [ ] | Double-click the installer | SmartScreen warns about an **unknown publisher**. This is expected — the build is unsigned |
| [ ] | **More info → Run anyway** | Installer opens. **No** administrator/UAC prompt (it installs per-user) |
| [ ] | Check the installer window | Product name reads **FDraft Studio**, version **0.1.0**, and the icon is Studio's own (dark tile, orange square) — not FDraft's |
| [ ] | Complete the install | Finishes without error |
| [ ] | Open Start menu | **FDraft Studio** entry present, correct icon |
| [ ] | Settings → Apps → Installed apps | One **FDraft Studio** entry, version 0.1.0, publisher **Burrichen**. FDraft, if installed, is a **separate** entry and untouched |

## 2. First launch and the tutorial (10 min)

| | Do this | Expect |
|---|---|---|
| [ ] | Launch from the Start menu | Window opens, correct title and taskbar icon. No error dialog, no blank white window |
| [ ] | Observe the first-run offer | The tutorial offers itself **once** |
| [ ] | Click **Skip for Now** | Closes cleanly, nothing else disrupted |
| [ ] | Click **Help** | Tutorial reopens at the start |
| [ ] | Click **Start Tutorial**, then **Next** through all 18 steps | Every step's text matches what you actually see in the app. **Flag anything describing a control that isn't there** — that's a doc bug worth catching |
| [ ] | Find the **What FDraft Studio Cannot Change** step | Present, lists the FDraft-owned concerns |
| [ ] | On the last step, open **User Guide** and **Troubleshooting** | Both render real content. Disconnect Wi-Fi first if you want to prove it's offline |
| [ ] | Click **Restart Tutorial** | Returns to step 1 |
| [ ] | Tab through with the keyboard only | Focus visible at every stop; Escape closes |
| [ ] | Press **Finish**, then reopen via Help | Reopens fine; completion was remembered |

## 3. Real editing work (15 min)

This is where GUI bugs actually live — Windows font metrics, DPI scaling, file
dialogs, clipboard.

| | Do this | Expect |
|---|---|---|
| [ ] | **New from template → Standard FDraft** | 8 pages created, canvas renders |
| [ ] | Open each official starter project you have to hand | Opens without error |
| [ ] | Import an image (drag onto the Assets grid) | Copied into the project; appears in the grid |
| [ ] | Confirm the copy-in behaviour | Move or delete the original file → the project still shows the image |
| [ ] | Double-click a text layer and type | Text edits directly on canvas; no clipping or wrong font size |
| [ ] | Move, resize, rotate, group and lock a layer | All behave sanely; snapping works |
| [ ] | Open **Copy Workspace** and edit a copy slot | Change persists |
| [ ] | Edit an event pop-up | Opens and edits |
| [ ] | Cycle **Desktop / Laptop / Mobile** in Preview | Layout reflows, no editor chrome leaks into the preview |
| [ ] | **Simulate mode** — change event status and progress | Rendering responds |
| [ ] | If testing Halloween: sweep progress 0 → 100% | Candy Bowl changes state (empty → low → medium → full) |
| [ ] | If testing January: switch performance tier high → low | Rain/clouds/fog present at high, absent at low |
| [ ] | Check at 150% Windows display scaling | Text and icons scale, nothing overlaps or gets cut off |

## 4. Save, reopen, recovery (5 min)

| | Do this | Expect |
|---|---|---|
| [ ] | **Save As** into Documents | `.fdstudio` file written |
| [ ] | Close and reopen it | Everything is exactly as you left it |
| [ ] | Save into a path with **spaces and a non-English character** (e.g. `Documents\Test Ünïcode\`) | Saves and reopens fine |
| [ ] | Make an edit, then kill the app from Task Manager | — |
| [ ] | Relaunch | Offers to restore the unsaved work; accepting does **not** clobber your last explicit save |
| [ ] | **Export project…** (`.fdstudio`) and **Export theme…** (`.fdtheme`) | Both produce files with a pre-flight summary |

## 5. FDraft interop (optional — read this first)

The FDraft side is **already verified**, just not on Windows: all three
official events were published and rendered against a real running FDraft
server with zero console errors, and FDraft renders through the *same*
`@fdraft/theme-renderer` package on every platform. Building a Windows FDraft
release purely to repeat that is a lot of work for very little new signal.

So this section is optional. If you do have a Windows FDraft build to hand:

| | Do this | Expect |
|---|---|---|
| [ ] | Import/point FDraft at an exported `.fdtheme` | Renders |
| [ ] | Try a deliberately corrupt `.fdtheme` | Safely rejected, FDraft still usable |
| [ ] | Try a theme needing an unsupported capability | Rejected with a clear reason, not mis-rendered |

If you skip it, say so in the record below rather than leaving it ambiguous.

## 6. Upgrade and uninstall (5 min)

| | Do this | Expect |
|---|---|---|
| [ ] | Run the same installer again over the install | Completes; still **one** entry in Installed apps and **one** Start menu shortcut |
| [ ] | Launch again | Your projects and recent-projects list are intact |
| [ ] | Uninstall via Settings → Apps | Removes cleanly, no leftover Start menu entry |
| [ ] | Check your `.fdstudio` files | **Still there.** Uninstall must never delete your work |
| [ ] | Check FDraft, if installed | Completely unaffected |
| [ ] | Check `%APPDATA%\com.fdraftstudio.app` | Still present (recent projects / tutorial state survive uninstall by design) |

---

## Record the result

```
Windows version + build:        (winver)
Architecture:                   x64
Installer SHA-256 tested:
Candidate commit:
FDraft tested against:          (commit + version, or "not tested on Windows — see section 5")
Date:
Result:                         PASS / PASS WITH ISSUES / FAIL
Issues found:
```

**If it passes:** publish with

```
git tag studio-v0.1.0 && git push origin studio-v0.1.0
```

Then do the post-publication check in `RELEASE_CHECKLIST.md` section G — download
from the *public* Release page and confirm the checksum matches, because
"the artifact built fine" and "the artifact I just downloaded is that artifact"
are different claims.

**If it fails:** don't tag. Record the failure, fix it, and re-run the build —
the tag should only ever point at a commit that passed this pass.
