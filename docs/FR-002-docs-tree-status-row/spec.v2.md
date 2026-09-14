# FR-002: Fixed Docs Tree Status Row

**Revision**: 2 (supersedes v1)
**Date**: 2026-09-14
**Trigger**: Bug
**Reason**: FR-1's "always non-empty message" requirement unintentionally suppresses the pre-existing "Scaffold
Spec-Driven Development Structure" welcome content for a genuinely empty workspace folder (no tracked docs, no
`.specmesh.yml`) — VS Code's `viewsWelcome` only renders when the tree has zero children **and** no
`TreeView.message` is set, so the always-populated status row silently hides that button after every crawl.
**Status**: Approved
**Full spec**: see [spec.v1.md](./spec.v1.md) — only what changed is listed below

## Revision Summary

- FR-1 carve-out for the true-empty state — the status row is cleared (not populated) when a crawl finds zero
  tracked docs across every workspace folder, so the "Scaffold Spec-Driven Development Structure" welcome
  button can render instead.

## Functional Requirements Changed

- ~~FR-1: The Docs Explorer tree view's status row is never empty/removed — `treeView.message` always holds a
  non-empty string, both before the first crawl, during a crawl, and after every subsequent refresh.~~
  **Now:** FR-1: The status row holds a non-empty string before the first crawl, during a crawl, and after every
  subsequent refresh **except** when a completed crawl finds zero tracked docs and zero missing-tracked-file
  problems across every workspace folder — in that case the row is cleared (`treeView.message = undefined`) so
  the tree is recognized as empty and its `viewsWelcome` content (the scaffold/`.specmesh.yml` guidance) renders
  instead of the summary line.

## Assumptions (new)

- The status-row-vs-empty decision (whether to clear `treeView.message` or populate it) is extracted into a
  small `vscode`-free pure function so it can be covered by a Mocha unit test per
  [ADR-001](../adr/ADR-001-testing-strategy.md), instead of only being exercisable via a full Extension
  Development Host test of the real tree view.

## Open Questions

- None.
