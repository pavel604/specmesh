# FR-018 Tasks: `${workspaceFolder}` Markdown Link Resolution

- [x] T1: Export `resolveLinkTarget` from `src/crawler/crawler.ts`, add `workspaceFolderPath: string` param.
- [x] T2: Add `${workspaceFolder}` prefix detection/resolution before the existing relative-path fallback.
- [x] T3: Update the call site in `crawlWorkspaceFolder` to pass `folder.uri.fsPath`.
- [x] T4: Add `src/test/crawler.test.ts` covering plain-relative regression, `${workspaceFolder}/...` at
      varying nesting depth, bare `${workspaceFolder}`, and a non-existent `${workspaceFolder}` target.
- [x] T5: Update the "Broken cross-repo link detection" bullet in `README.md`.
- [x] T6: Run `npm test`, confirm all passing, no regressions.
