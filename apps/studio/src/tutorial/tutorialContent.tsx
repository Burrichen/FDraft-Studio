import type { ReactNode } from "react";

/**
 * The built-in tutorial's real content — one entry per step, in order.
 * Every label quoted here (button text, mode names, panel names) is the
 * genuine current UI text, matching `docs/guides/USER_GUIDE.md`'s own
 * exact terminology — never a mock-up or a planned/future feature. If a
 * real label changes, update it here in the same change, per this
 * project's own "teach the real current interface" requirement.
 */
export interface TutorialStep {
  id: string;
  title: string;
  body: ReactNode;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to FDraft Studio",
    body: (
      <>
        <p>FDraft Studio is where you design FDraft's event pages, pop-ups, artwork states, and safe visual behaviours — without writing HTML, CSS, or React.</p>
        <p>This short tour walks through the real screens you'll use, in the order you'll actually use them. You can revisit it any time from <strong>Help → Tutorial</strong>.</p>
      </>
    ),
  },
  {
    id: "starting",
    title: "1. Starting a project",
    body: (
      <>
        <p>The Startup Screen offers two starting points:</p>
        <ul>
          <li><strong>New Project</strong> — name your project and pick a starter template (Standard FDraft, Immersive, Minimal, Poster, or Blank).</li>
          <li><strong>Open Project…</strong>, <strong>Open Unpacked Project Folder…</strong>, or one of your <strong>Recent Projects</strong> — including the official Halloween, Christmas, and "F* You, It's January!" starter projects included with Studio.</li>
        </ul>
        <p>If Studio finds unsaved autosave data from last time, it offers to recover it first — before anything else.</p>
      </>
    ),
  },
  {
    id: "structure",
    title: "2. Pages, pop-ups, masters, layers, and protected components",
    body: (
      <>
        <p>The left panel lists your project's <strong>Pages</strong>, event <strong>Pop-ups</strong>, and <strong>Masters</strong> (shared layouts other pages inherit from). Selecting one shows its layer tree.</p>
        <p>A layer is usually an image, a shape, text, an effect, or a group — but some are <strong>protected FDraft components</strong> (like a draft-controls panel or a points counter). These render FDraft's real, working functionality; a theme can move, resize, and style them, but never replace what they do.</p>
      </>
    ),
  },
  {
    id: "importing",
    title: "3. Importing your own images",
    body: (
      <>
        <p>Switch to <strong>Assets</strong> mode and drag files in, paste from your clipboard, or use <strong>Import…</strong>. Every image is copied into your project immediately — Studio never keeps a link back to your Downloads folder or any other original location.</p>
        <p>The Asset Detail panel shows exactly where each image is used, and <strong>Find unused</strong> flags anything nothing references any more.</p>
      </>
    ),
  },
  {
    id: "canvas",
    title: "4. Positioning, resizing, and organising layers",
    body: (
      <>
        <p>On the canvas, drag to move, use the corner/edge handles to resize, and the rotate handle to rotate — all rotation-aware. The Properties panel gives exact X/Y/width/height/rotation/opacity fields for precise adjustments, plus crop and mask controls.</p>
        <ul>
          <li><strong>Layering</strong>: reorder, group, and ungroup from the Layers panel or canvas shortcuts.</li>
          <li><strong>Locking</strong>: lock a layer to stop accidental edits.</li>
          <li><strong>Guides &amp; snapping</strong>: layers snap to the page edges and to each other automatically while dragging.</li>
          <li><strong>Anchoring</strong>: responsive layers can anchor to an edge or center so they behave predictably at different sizes.</li>
        </ul>
      </>
    ),
  },
  {
    id: "responsive",
    title: "5. Checking responsive layouts",
    body: (
      <>
        <p>Switch to <strong>Preview</strong> mode and use the <strong>‹ Desktop / Laptop / Mobile ›</strong> cycler to see your page at each real viewport profile, with no editor chrome in the way.</p>
      </>
    ),
  },
  {
    id: "text",
    title: "6. Editing text directly on the canvas",
    body: (
      <>
        <p>Double-click any text layer to edit it in place, right where it will actually appear. The Properties panel also offers the same editing for alignment and styling.</p>
      </>
    ),
  },
  {
    id: "copy-workspace",
    title: "7. Copy Workspace",
    body: (
      <>
        <p>Open <strong>Copy review</strong> from the top bar to see every editable copy slot across every page and pop-up in one place — grouped and searchable, with a category filter and a <strong>Go to</strong> shortcut that jumps straight to any flagged slot.</p>
        <p>Copy review flags text that's still showing FDraft's default wording, required slots left blank, unresolved placeholders, and anything with no accessible fallback.</p>
      </>
    ),
  },
  {
    id: "placeholders",
    title: "8. Placeholders and controlled values",
    body: (
      <>
        <p>Some copy slots accept typed placeholders like <code>{"{{eventName}}"}</code> or <code>{"{{progress}}"}</code> — Studio only substitutes the ones a slot explicitly allows. An unresolved placeholder stays visible as plain text rather than silently disappearing, so it's easy to spot.</p>
        <p>Placeholders always resolve to a real, FDraft-supplied value at render time. A theme can never invent its own number or date.</p>
      </>
    ),
  },
  {
    id: "behaviour",
    title: "9. Image states and conditional visibility",
    body: (
      <>
        <p>In <strong>Assets</strong> mode, an <strong>Image State Group</strong> lets one layer swap between several images (for example, a container that visibly fills up). In <strong>Behaviour</strong> mode, a no-code rule (trigger → condition → action) can switch that state, or show/hide a layer, based on read-only values like progress percentage — with a live trace showing exactly which rule is winning and why.</p>
      </>
    ),
  },
  {
    id: "animations",
    title: "10. Animations and effects, safely",
    body: (
      <>
        <p>Layers can carry entrance/idle animations and ambient effect layers (like rain or falling leaves). Every effect respects the current performance tier and reduced-motion setting automatically — themes cannot request unbounded particles or motion.</p>
      </>
    ),
  },
  {
    id: "simulate",
    title: "11. Simulating event states",
    body: (
      <>
        <p><strong>Simulate</strong> mode lets you step through saved scenarios (e.g. "just opened," "half full," "ended") and see your page respond exactly as it would in FDraft — combined with the same viewport, performance-tier, and reduced-motion controls from Preview mode.</p>
      </>
    ),
  },
  {
    id: "saving",
    title: "12. Saving, autosave, recovery, and snapshots",
    body: (
      <>
        <p>Studio saves your work as an editable <strong>.fdstudio</strong> project. It also autosaves to a separate recovery slot in the background and offers to restore it if Studio closes unexpectedly. Named <strong>snapshots</strong> let you keep a labelled checkpoint you can restore later without losing your current work.</p>
      </>
    ),
  },
  {
    id: "export",
    title: "13. Validating and exporting a .fdtheme",
    body: (
      <>
        <p>Open <strong>Validate</strong> at any time to see blocking errors and advisory design warnings, each with a <strong>Go to</strong> shortcut. Once it's clean, use <strong>Export theme…</strong> in Assets mode to compile a deterministic <strong>.fdtheme</strong> — the runtime package FDraft actually reads. <strong>Export project…</strong> next to it saves a portable <strong>.fdstudio</strong> backup instead.</p>
      </>
    ),
  },
  {
    id: "publish",
    title: "14. Publishing to a linked FDraft checkout",
    body: (
      <>
        <p>Use <strong>Link FDraft Repo</strong> to point Studio at a local FDraft checkout, then <strong>Publish to FDraft</strong>. Studio stages a clear add/change/remove summary and requires your explicit confirmation before writing anything — never a silent overwrite. Publishing keeps one backup generation, so a bad publish can be undone.</p>
      </>
    ),
  },
  {
    id: "compatibility",
    title: "15. Understanding compatibility errors",
    body: (
      <>
        <p>Before publishing, Studio checks your project against the linked FDraft build's real, currently-supported component keys and capabilities — the exact same check FDraft itself runs. If something isn't supported yet, Studio tells you precisely which component key or capability is the problem, so you can address it rather than guess.</p>
      </>
    ),
  },
  {
    id: "cannot-change",
    title: "What FDraft Studio Cannot Change",
    body: (
      <>
        <p>Themes control presentation only. FDraft always keeps control of:</p>
        <ul className="tutorial-cannot-change-list">
          <li>event dates and availability</li>
          <li>joining and leaving events</li>
          <li>film eligibility</li>
          <li>draft generation</li>
          <li>watched state</li>
          <li>event progress</li>
          <li>points and rewards</li>
          <li>profile data</li>
          <li>destructive confirmations</li>
          <li>safety-critical messages</li>
          <li>runtime-generated values</li>
          <li>application actions</li>
        </ul>
        <p>A theme may present and style the approved components and copy above — it can never replace the real logic behind them.</p>
      </>
    ),
  },
  {
    id: "finish",
    title: "You're ready",
    body: (
      <>
        <p>That's the real interface, start to finish. You can restart this tutorial any time from <strong>Help → Tutorial</strong>, or open the bundled User Guide and Troubleshooting docs below for more detail.</p>
      </>
    ),
  },
];
