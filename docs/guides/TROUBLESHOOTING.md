# FDraft Studio — Troubleshooting

Mapped to the actual messages/UI Studio produces today, not generic advice.

## "This project's file or folder could not be found."

Shown when the file/folder a project was opened from has been moved or deleted since. The
project stays open in memory — use **Save As** to a new location; nothing is lost unless you
close without saving.

## "This file is in use by another program..."

Something else has the project's `.fdstudio` file open — another Studio window, a sync
client, or antivirus scanning it mid-write. Close whatever else has it open and try again;
Studio never leaves a partial write behind (every save is atomic — write to a temp location,
then rename into place — so an interrupted save can't corrupt the original).

## "...exceeds Windows' path length limit"

Windows' classic ~260-character path limit. Studio checks the *prospective* path before
writing anything — this appears before any bytes touch disk, never as a cryptic OS error
after a partial write. Choose a shorter project name or a less deeply-nested folder.

## Invalid package / can't open a `.fdstudio` or `.fdtheme`

Both formats are ZIP archives with a manifest declaring a SHA-256 hash per file; Studio
verifies every hash on open and refuses a package that fails (a corrupted download, a hand-
edited archive) rather than loading something silently wrong. It also rejects malformed
packages outright — path traversal, dangerous file extensions, oversized/zip-bomb-shaped
archives — before extracting anything. If a package fails to open, it's either genuinely
corrupted or was never a real FDraft-Studio package; there's no partial-recovery mode for
manifest-hash mismatches by design (a mismatch means the content can no longer be trusted).

## "Incompatible renderer" / a theme won't load in FDraft

FDraft checks a compiled theme's declared `minRendererVersion`/required component
keys/capabilities against what it actually has installed and supports before ever rendering
anything — an incompatible theme is safely rejected, never mis-rendered. In Studio, **Publish
to FDraft** runs the identical check *before* publishing, so this should surface there first,
with the specific unsupported component/capability named. If FDraft itself rejects an
already-published theme, either FDraft's installed renderer is older than the theme requires,
or the theme uses a capability (e.g. `animations`/`behaviour`/`effects`) that particular
FDraft build doesn't support the adapters for yet — check FDraft's own
`docs/fdraft-theme-runtime/INTEGRATION.md` for its exact supported set.

## Recovery: "restore unsaved work?"

Shown at startup when an autosave slot exists but wasn't cleanly closed last time (a crash,
a forced quit). The autosave slot is always separate from your real save — accepting the
restore never touches or overwrites the last file you explicitly saved unless you then save
over it yourself.

## "Preview in FDraft" shows "Not connected"

Studio only ever makes outbound requests to whatever URL is typed in (default
`http://localhost:3000`) — it never opens a listener of its own. "Not connected" means
nothing answered at that URL: confirm FDraft's own dev server (`pnpm run dev` in the FDraft
checkout) is actually running, and that the URL/port matches.

## "Preview in FDraft" shows a build/validation error

The current edit doesn't validate (or failed to compile) — the panel names the first blocking
error, and **the last successfully-built preview file is left untouched** so FDraft keeps
showing the last good version rather than a broken one. Fix the named issue and it rebuilds
automatically on your next save.

## Publish rollback

Every publish keeps exactly one prior version as a recoverable backup (not unlimited
history — a second publish after that discards the *oldest* generation, not the one just
made). If a publish turns out wrong, reopen **Publish to FDraft** and use **Undo this
publish** — it atomically restores the previous `theme-projects/<slug>/` and/or
`src/theme-packs/<slug>/` contents. This is separate from Git: Studio never commits anything,
so an already-committed bad publish also needs an ordinary `git revert` on your part.

## "A different project is already published under this slug"

Two projects produced the same URL-safe slug from their names (e.g. "Halloween!" and
"Halloween?" both slugify to `halloween`). Publish blocks this by default — check the
**"I understand this will overwrite..."** box only if you genuinely mean to replace what's
there; otherwise rename one of the two projects.
