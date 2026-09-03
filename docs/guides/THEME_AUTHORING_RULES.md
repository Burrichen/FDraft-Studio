# FDraft Studio — Theme Authoring Rules

What a theme may and may not control. Every rule below is enforced in code (schema
validation, semantic checks, or the renderer itself refusing to do the thing) — this is a
description of real, standing boundaries, not a style guide.

## A theme may

- Place and style layers: shapes, images, text, groups, effects, and protected FDraft
  components, positioned on a canvas with responsive breakpoint overrides.
- Define masters (shared layers inherited by pages/popups) and narrowly override one
  inherited layer's position/visibility/opacity per page — never its content or type.
- Author copy for every declared component copy slot, using only plain text plus typed
  `{{placeholder}}` tokens a slot explicitly allows — never markup, never an expression.
- Declare Behaviour rules: a closed set of triggers (continuous or lifecycle/interaction
  edges), conditions over a closed set of read-only runtime variables (event status/active/
  available, opted-in, progress, hover/focus/pressed/selected, etc.), and a closed set of
  purely presentational actions (show/hide, set an image state, apply an allow-listed style
  property, start/stop/restart an animation, navigate, select a copy variant).
- Declare animations (10 built-in presets or up to 12 hand-authored keyframes) and particle
  effects (11 kinds), both capped by FDraft's own performance tiers at render time.
- Declare image-state groups (e.g. a candy bowl's empty/low/medium/full states) whose active
  state a Behaviour rule sets — the *mapping* from a runtime value to a state is theme-
  authored and editable; the runtime value itself always comes from FDraft.

## A theme may never

- **Execute code.** There is no scripting surface anywhere in the schema — no expressions, no
  eval, no arbitrary CSS injection. SVG assets are sanitized (scripts, event handlers,
  external references stripped) and rejected outright if they can't be made safe.
- **Reach a remote asset.** Every asset is packaged inside the `.fdstudio`/`.fdtheme` archive,
  content-addressed by hash; external/remote URLs are rejected wherever a path is expected.
- **Mutate anything FDraft owns.** Profiles, drafts, points, watch state, event eligibility,
  and dates are never writable from a theme — Behaviour actions are a closed, purely
  presentational set, and the runtime variables a condition can read are read-only and
  closed too (no arbitrary profile fields, no filesystem, no network).
- **Decide eligibility or business logic.** An image-state group's progress *mapping* is
  theme content; the actual progress *value* is always supplied by FDraft. A theme can react
  to "70% or more," never decide what counts as 70%.
- **Replace a protected component's own behavior.** A component is placed and styled (within
  an allow-listed set of safe CSS properties) — its internal logic, data-fetching, and
  actions belong to FDraft's own adapter, never the theme.
- **Escape its own package.** Archive path traversal, absolute paths, and dangerous file
  extensions are rejected before anything is ever extracted.

## Copy and placeholders

Every component copy slot declares whether it's required, what its FDraft-approved default
text is, and which typed placeholders (if any) it accepts. A required slot can never resolve
to empty text — it falls back to the default rather than shipping blank. An unresolved or
disallowed `{{placeholder}}` is left visibly literal in the text rather than silently
stripped, so it's easy to spot in Copy Review rather than quietly wrong in production.

## Host-owned text

A small amount of text is never editable from a theme — FDraft's own safety-critical, legal,
diagnostic, and recovery-related strings (error messages, permission prompts, legal/consent
copy) stay entirely inside FDraft, deliberately outside any theme's reach. If you find text
in FDraft you'd expect to be a theme copy slot but isn't, it's very likely one of these
categories rather than an oversight — check with the FDraft side before assuming it should
move.
