# Product contract

## Product

FDraft Studio is a separate Windows desktop application for designing FDraft pages, event themes, popups, artwork states, responsive layouts, animations, and safe visual behaviours.

Its intended user does not need to know HTML, CSS, React, Tauri, or Git.

## Responsibility split

- **FDraft Studio** creates and edits theme projects, imports assets, previews them, validates them, and exports them.
- **Theme SDK** defines schemas, validation, migrations, package formats, compatibility, security limits, and compilation.
- **Theme renderer** turns validated theme data into visible pages in both Studio and FDraft.
- **FDraft** owns films, drafts, profiles, points, event dates, eligibility, opt-in, watch state, and every action that changes real user data.

## Files

- `.fdstudio` is the complete editable project package.
- `.fdtheme` is the deterministic compiled runtime package consumed by FDraft.
- Unpacked project directories are supported so official themes and their assets can be reviewed in Git.

Imported artwork is copied into the project immediately. A working project must not depend on Downloads, Desktop, a temporary folder, a removable drive, or a remote URL.

## Version 1 includes

- a full-screen visual editor;
- project-owned images and bundled safe fonts;
- layers, groups, transforms, crop, masks, snapping, guides, undo, recovery, and snapshots;
- pages, popups, masters, templates, reusable visual components, protected FDraft components, and responsive tools;
- declarative event and interaction states;
- bounded animations and seasonal effects;
- event simulation, true preview, development FDraft preview, import/export, and safe local publishing;
- validation, migrations, compatibility checks, security limits, tests, CI, and a separate installer.

## Version 1 excludes

- arbitrary JavaScript or executable theme code;
- remote scripts or remote asset URLs;
- audio editing;
- a public marketplace;
- cloud collaboration or account sync;
- automatic Git commits, pushes, pulls, or GitHub API actions;
- Carnival.

## Success

A person who does not know web development can import their own artwork, visually compose responsive FDraft event pages, define safe visual states, recover from mistakes, export a portable theme, and publish it into FDraft without editing application code. FDraft remains usable if Studio, a project, or a theme fails.

