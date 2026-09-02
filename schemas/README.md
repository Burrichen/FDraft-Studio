# Schemas

The `.schema.json` files here are **generated**, not hand-maintained. The source of truth is the Zod schemas in `packages/theme-sdk/src/schema/`; these files are produced from them via `z.toJSONSchema()` (Zod v4's built-in JSON Schema converter — no extra dependency needed).

- Regenerate after any schema change: `pnpm --filter @fdraft/theme-sdk generate:schemas`
- Check for drift (CI-safe, fails without writing): `pnpm --filter @fdraft/theme-sdk check:schemas`

| File | Zod source |
| --- | --- |
| `studio-project.schema.json` | `StudioProjectDocumentSchema` (`schema/project.ts`) |
| `runtime-theme.schema.json` | `RuntimeThemeDocumentSchema` (`schema/theme.ts`) |
| `fdstudio-manifest.schema.json` | `StudioPackageManifestSchema` (`packaging/fdstudio.ts`) |
| `fdtheme-manifest.schema.json` | `RuntimeThemeManifestSchema` (`schema/theme.ts`) |

Never edit these files by hand — a hand-edit will be silently overwritten by the next `generate:schemas` run and won't be caught by `check:schemas` either way, since drift-checking compares against the Zod source, not against itself.

