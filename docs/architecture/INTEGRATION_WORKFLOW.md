# Integration workflow

## Which repository to open

Most prompts run in `FDraft-Studio`. The dedicated FDraft integration prompt clearly tells the user to open the existing `FDraft` repository instead. Never assume the active repository.

Before editing, print and verify:

- the repository root;
- current branch and working-tree state;
- the prompt's expected repository;
- the sibling repository path, if needed;
- the exact SDK and renderer versions involved.

Stop if the repository is wrong or the working base is ambiguous.

## Studio to FDraft

Studio links to a user-selected local FDraft checkout. It validates the repository and compatibility before preview or publishing.

For an official theme, the preferred flow is:

1. open or create `FDraft/theme-projects/<theme>/` in Studio;
2. import artwork, which is copied under that editable project;
3. save and validate the unpacked project;
4. compile deterministic runtime output;
5. preview a clear add/change/remove summary;
6. atomically publish only to `FDraft/src/theme-packs/<theme>/`;
7. use normal Git tools outside Studio to review and commit both source and runtime changes.

If the working project lives elsewhere, Studio may offer to copy a readable source snapshot into `theme-projects/<theme>/` during publish. It must never delete unrelated files or replace a different project with the same slug without explicit confirmation.

## Development preview

The FDraft integration supplies an explicitly development-only preview command or launch option. Studio compiles to a temporary validated package and passes only local paths plus safe mock/read-only state. The last valid preview remains active when the current edit is invalid.

No listener may be exposed beyond the local machine. Preview must not modify real profiles, dates, points, drafts, opt-in state, or watch state.

## Git boundary

Studio may display changed paths and suggested Git commands. It must not commit, push, pull, checkout, reset, clean, or call GitHub APIs.

