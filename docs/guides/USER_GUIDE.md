# FDraft Studio — User Guide

A plain-language walkthrough of the actual current UI. If something described here isn't
what you see on screen, the app has moved ahead of this doc — please flag it.

## Starting a project

On launch, the Startup Screen offers **New from template** (Standard FDraft, Immersive,
Minimal, Poster, Blank) or a list of recent projects. Templates are real, editable starting
points — not a rendering shortcut — built from the same schema and editor as any hand-built
project. "Standard FDraft" gives you all 8 registered FDraft event surfaces (Event Landing,
Draft, Results, Completion, About/Information, Event Available, Join, Event Complete), each
with a stable copy slot per author-written string and an approved FDraft default.

## Importing artwork

Open the **Assets** mode. Drag files onto the grid, paste from the clipboard, or use
**Import…** for a native multi-file picker. Every imported file is copied into the project's
own asset pool (content-addressed by its SHA-256 hash) — Studio never keeps a link back to
wherever the file came from. SVGs are automatically sanitized (scripts, event handlers,
external references stripped) and rejected outright if they can't be made safe. The detail
panel shows real usage ("where used," resolving to the actual page/layer), and **Find
Unused** finds assets nothing currently references.

## Designing

**Design mode** is the main canvas: pan/zoom, single/shift-multi/marquee select, 8-handle
resize + rotate (both rotation-aware), drag-move with snapping, keyboard nudge, and
copy/cut/paste/duplicate/group/ungroup/z-order via the usual shortcuts. The Properties panel
edits transform, opacity, crop, mask, text/alignment, and (for shapes) fill/gradient/radius
tokens with inline "+ New…" quick-create. The Layers panel gives you a nested tree with
visibility/lock toggles and drag-reorder.

**Masters** hold layers shared across pages; a page/popup can narrowly override one inherited
layer's position/visibility/opacity (never its content) and "detach" to make an independent
copy. **Components** are protected FDraft building blocks (event countdown, draft controls,
points counter, etc.) — themes place and style them within an allowed set, never replace
their logic. Each declares typed copy slots; edit them in the Properties panel's Copy
section, using `{{placeholder}}` tokens for anything genuinely dynamic (an event name, a
count) rather than hard-coding a guess.

## Behaviours

**Behaviour mode** is a no-code rule builder: trigger (continuous or edge-based) → condition
(a closed set of safe, read-only variables — event status, progress, opted-in, hover/focus,
etc.) → one or more presentational actions (show/hide, set an image state, apply a style,
start an animation, navigate). Rules never touch points, drafts, eligibility, or profile
data — FDraft's own logic stays in FDraft. The live Simulator drives real hover/focus
interaction from the actual preview; **Show trace** explains exactly which rule won each
contested target and why.

## Simulation

**Simulate mode** is the dedicated version of the same simulator: pick a built-in or
project-saved scenario (event status, progress, viewport-relevant data profile, simulated
date/time, placeholder values — never the real clock or real profile data) and see it render
live, with the same rule trace available. Save your own scenarios for repeatable QA (e.g.
"Halloween candy bowl at 80% progress").

**Copy review** (a TopBar button) walks every page/popup/component/scenario and flags text
falling back to the FDraft default, blank required slots, unresolved placeholders, and
missing accessible-name fallbacks — plus a live "Scan for clipped text" pass that measures
real rendered overflow.

## Preview mode

Hides every editor control and shows exactly what the shared renderer produces, with a
minimal bar to cycle Desktop/Laptop/Mobile viewport profiles and return to editing. Nothing
here — no selection marker, no mock control — ever leaks into the rendered output itself.

## Export, publish, and dev preview

- **Export** (from Assets mode) produces a `.fdstudio` (editable source) or `.fdtheme`
  (compiled runtime) package, with a real pre-flight analysis (capabilities, required
  components, actual compiled size, blocking errors) shown before you commit.
- **Preview in FDraft** (TopBar, development-only) compiles to a temp file and connects to a
  local FDraft dev server you already have running — auto-rebuilding after every save.
- **Publish to FDraft** (TopBar, after **Link FDraft Repo**) compiles, checks compatibility
  against the linked FDraft checkout's own real, committed capabilities, shows an exact
  add/change/remove diff, and — only after you confirm — atomically writes the editable
  source to `theme-projects/<slug>/` and the compiled `.fdtheme` to
  `src/theme-packs/<slug>/`. It never runs Git; it shows you the plain commands to run
  yourself afterward. A publish keeps one recoverable backup — **Undo this publish** restores
  it.

## Recovery

Studio autosaves to a separate recovery slot (never overwriting your real save). If it
detects unsaved work from a previous session on next launch, it offers to restore it. Named
snapshots (with restore-as-new-version) are available for point-in-time checkpoints beyond
autosave.
