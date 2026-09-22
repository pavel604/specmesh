# FR-018 Walkthrough: `${workspaceFolder}` Markdown Link Resolution

## What changed

- `resolveLinkTarget` (in `src/crawler/crawler.ts`) now recognizes a link target starting with
  `${workspaceFolder}` and resolves it against the linking document's own workspace folder root, instead of
  treating `${workspaceFolder}` as a literal relative subfolder name (which never exists, so every such link
  was previously flagged broken even when the real target existed).
- Plain relative targets (`../foo.md`, `./bar.md`, `foo.md`) resolve exactly as before — this is additive.
- The one call site now passes `folder.uri.fsPath` through to `resolveLinkTarget`.

## How to verify

1. In any tracked doc, add a link like `[charter](${workspaceFolder}/docs/charter.md)`.
2. Confirm no squiggly/Problems-panel entry appears for that link (assuming the target exists).
3. Change the target to a path that doesn't exist (e.g. `${workspaceFolder}/docs/nope.md`) and confirm it
   *is* still flagged broken — the fix only removes false positives, not real breakage.

## Tests

- New `src/test/crawler.test.ts`: 5 tests covering plain-relative resolution (regression), `${workspaceFolder}`
  resolution at varying nesting depths, bare `${workspaceFolder}`, and a non-existent `${workspaceFolder}`
  target still resolving to an absolute path (existence remains a separate check).
- Full suite: `npm test` → 106 passing, 0 failing (up from 101).

## Docs updated

- `README.md`'s "Broken cross-repo link detection" bullet now mentions `${workspaceFolder}/...` support.
- `docs/epics/EPIC-001-docs-explorer-authoring.md` — added FR-018 row + changelog entry.
