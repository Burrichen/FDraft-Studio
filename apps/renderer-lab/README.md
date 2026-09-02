# Renderer fixture lab

A small Vite + React app that develops and visually proves `@fdraft/theme-renderer` independently of the FDraft application and before any Studio UI exists (Prompt 3). It is not part of the Studio application and ships nowhere — it's a dev tool.

## Run it

```
pnpm --filter @fdraft/renderer-lab dev       # http://localhost:5183
pnpm --filter @fdraft/renderer-lab build     # production build, tree-shaken
pnpm --filter @fdraft/renderer-lab typecheck
```

## What it loads

`src/plugins/fdraftFixturesPlugin.ts` is a Vite plugin exposing a `virtual:fdraft-fixtures` module. The genuinely Node-only step — reading the unpacked `fixtures/projects/sample-event/` directory via `@fdraft/theme-sdk/node` (real `node:fs`) — happens there, once, at dev-server-start/build time. (`@fdraft/theme-sdk/packaging`'s pack/unpack/hash code is actually browser-safe too now — sha256 via Web Crypto, not `node:crypto` — the plugin just keeps all fixture loading in one Node-side place regardless, so the browser bundle never needs any of it.) The browser only ever receives plain JSON plus base64 `data:` asset URLs.

The app itself (`src/App.tsx`, `src/preflight.ts`) then runs the SDK's real `validateProject`/`validateTheme`/`migrateProject` **live in the browser** on every scenario — a genuine client-side compatibility preflight, not something baked in at load time. See `@fdraft/theme-sdk`'s own README for the module boundary (`@fdraft/theme-sdk` main export vs. `@fdraft/theme-sdk/packaging` vs. `@fdraft/theme-sdk/node`).

## What it proves

- A theme renders correctly with **zero** Studio editing code in the picture — only SDK output plus this package's own sample component-adapter registry.
- Invalid/unsupported-version fixtures fail with a visible, readable, path-specific error panel instead of a blank page or a crash.
- Switching page/popup, viewport width, reduced motion, performance tier, and mock image-state-group selection all update the render live.
- A side-by-side mobile/desktop comparison, for a quick visual parity check against a stable fixture.
