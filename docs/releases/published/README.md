# Published releases

The manifest and checksums for each **published** GitHub Release, as downloaded
back from the public Release page — not as the build machine produced them. The
distinction matters: "the build succeeded" and "the bytes on the download page
are those bytes" are different claims, and this directory records the second.

## `studio-v0.1.0` — first public Windows pre-release

- **Release:** https://github.com/Burrichen/FDraft-Studio/releases/tag/studio-v0.1.0
- **Channel:** pre-release (not marked "Latest")
- **Tagged commit:** `79f7c90fe56af5f93e22aa99663a5061fdef1ae9`
- **Workflow run:** [33796456397](https://github.com/Burrichen/FDraft-Studio/actions/runs/33796456397)
- **Installer:** `FDraft-Studio-0.1.0-Windows-x64-Setup.exe`, 2,365,709 bytes
- **SHA-256:** `8ec84d04cf325c9cbf2037ea7b31f5b5f83d9ab6773fbc56ef9e48b806310282`
- **Signing:** unsigned — no Authenticode certificate exists for this project
- **Assets:** installer, `SHA256SUMS.txt`, `release-manifest.json`, `LICENSE.txt`,
  `THIRD_PARTY_NOTICES.md`

Post-publication verification actually performed: the installer was downloaded
from the public Release page, `sha256sum -c SHA256SUMS.txt` returned `OK`, the
recomputed hash matched the manifest exactly, and the manifest names this tag,
this commit and this workflow run.

**Deliberately not claimed:** no human has driven the installed application on
Windows, and no theme has been rendered in a Windows FDraft build. The release
notes say so on the release page itself. See
`docs/guides/WINDOWS_VERIFICATION_PASS.md` for the pass that closes that gap —
it is the gate for a stable channel, not for this beta.
