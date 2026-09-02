# Two-repository architecture

## Decision

Use two repositories with one versioned shared runtime contract.

### `FDraft-Studio`

Owns the Studio application and the source of the shared packages:

```text
FDraft-Studio/
  apps/studio/
  packages/theme-sdk/
  packages/theme-renderer/
  schemas/
  fixtures/
  docs/
```

### `FDraft`

Remains the production application and integration target:

```text
FDraft/
  theme-projects/
    halloween/
    christmas/
    january/
  src/theme-packs/
    halloween/
    christmas/
    january/
```

`theme-projects/` contains readable editable project sources and original project-owned artwork. `src/theme-packs/` contains deterministic compiled runtime output. The exact paths may be adapted once the real FDraft repository is inspected, but the source/runtime distinction must remain.

## Why this works

The repositories do not need shared Git history. They need shared, versioned package contracts:

- `@fdraft/theme-sdk` defines the data and package rules;
- `@fdraft/theme-renderer` displays validated data;
- Studio uses both packages with mock FDraft component adapters;
- FDraft uses both packages with real component adapters and real read-only render context.

The renderer package never imports the Studio application or FDraft business logic. Host-specific adapters point inward from each application to the shared renderer.

## Development checkout

Keep both repositories as siblings:

```text
Projects/
  FDraft/
  FDraft-Studio/
```

This makes read-only inspection, local preview, and package testing straightforward. It is a convenience, not a production dependency.

## Forbidden coupling

- Do not copy FDraft into the Studio repository.
- Do not copy SDK or renderer source into FDraft.
- Do not build new Studio work on the failed Event Studio branch.
- Do not commit sibling-relative package dependencies.
- Do not let themes import React components or call FDraft services directly.
- Do not let Studio run Git operations on either repository.

