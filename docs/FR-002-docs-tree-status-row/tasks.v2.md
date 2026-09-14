# Migration Tasks: FR-002 v1 → v2

- [x] T1 — In [src/extension.ts](../../src/extension.ts), rename `formatStatusMessage` to `computeStatusMessage`,
      change its return type to `string | undefined`, return `undefined` when `docCount === 0 && missingCount ===
      0`, and export it.
- [x] T2 — Update the call site in `refresh()` to use the renamed `computeStatusMessage`.
- [x] T3 — Add `src/test/statusMessage.test.ts` covering: (a) zero docs/zero missing → `undefined`, (b) non-zero
      docs with zero broken links/orphans → full formatted string with zero counts, (c) non-zero missing with
      zero docs → still a formatted string (not `undefined`).
- [x] T4 — Run `npm test` and fix any build/lint errors.
