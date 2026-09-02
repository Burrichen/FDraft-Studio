# Claude Code instructions for FDraft Studio

Before changing code, read these files in order:

1. `docs/architecture/PRODUCT_CONTRACT.md`
2. `docs/architecture/TWO_REPOSITORY_ARCHITECTURE.md`
3. `docs/architecture/COMPATIBILITY_AND_RELEASES.md`
4. `docs/architecture/INTEGRATION_WORKFLOW.md`
5. `docs/IMPLEMENTATION_STATUS.md`

## Non-negotiable boundaries

- This is the `FDraft-Studio` repository. It is not the FDraft application repository.
- Never copy the old broken Event Studio branch or the FDraft application into this repository.
- Inspect a sibling FDraft checkout read-only unless a prompt explicitly says to switch to that repository and the user has approved that phase.
- Studio edits declarative data. It never generates React, CSS, HTML, JavaScript, or FDraft source code.
- Themes cannot execute code, reach remote assets, or mutate profiles, drafts, points, watch state, event eligibility, or dates.
- `packages/theme-sdk` and `packages/theme-renderer` are the single source of truth for the shared contract and renderer.
- FDraft must consume exact released versions. Never commit `latest`, floating ranges, or local sibling `file:` paths to FDraft.
- Local sibling linking is allowed only as a documented, uncommitted development override.
- Do not run Git commit, push, pull, reset, clean, checkout, branch deletion, or GitHub API operations unless the user explicitly requests that exact operation.
- Preserve unrelated work and stop when the correct FDraft base, repository path, or release version is ambiguous.
- Update `docs/IMPLEMENTATION_STATUS.md` with real command and test evidence. A UI control alone is not proof that a feature works.

## Working method

- Use the repository's selected package manager and lockfile consistently.
- Prefer small, reviewable phases with tests before UI expansion.
- Keep the SDK framework-neutral and the renderer host-agnostic.
- Preview and FDraft runtime must use the same renderer implementation.
- Treat malformed packages, unsafe SVG, archive traversal, crashes, and interrupted saves as first-class test cases.
- Do not weaken tests to make a phase appear complete.

