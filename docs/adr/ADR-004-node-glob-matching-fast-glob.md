# ADR-004: Node-Native Glob Matching via `fast-glob`

**Status**: Accepted
**Date**: 2026-09-25

## Context

[FR-019](../FR-019-mcp-server/spec.v1.md)'s standalone MCP server needs a Node-native replacement for
`vscode.workspace.findFiles` (used by [crawlWorkspace()](../../src/crawler/crawler.ts) today), since it runs
outside any extension host. specmesh's doc-type globs (`docs/adr/ADR-*.md`, `**/*.md`, brace-list excludes like
`{.specmesh/**,node_modules/**}`, etc., defined per `.specmesh.yml`/`DocTypeDefinition.glob`) must match
equivalently under both `vscode.workspace.findFiles` (extension) and the new Node path (MCP server) — a
divergence here would make the two entry points return different doc sets for the same repo, undermining
FR-019's core "never diverges" requirement.

## Options Considered

1. **Hand-roll glob matching over `fs.readdir` recursion.** Rejected — glob syntax used across existing
   `.specmesh.yml` configs and built-in doc types (`*`, `**`, `?`, `[...]`, `{a,b}` brace expansion) has enough
   edge cases that a hand-rolled matcher risks silently diverging from `vscode.workspace.findFiles`'s own
   (also-glob-library-backed) matching — exactly the class of bug FR-019 exists to prevent between its two
   entry points.

2. **`fast-glob`.** A widely-used, actively maintained glob-matching library with full brace-expansion and
   `**` support, matching the glob semantics specmesh's doc-type patterns already rely on. No existing dependency
   in the repo already provides this (the only current dependency is `yaml`).

## Decision

Adopt **Option 2**: add `fast-glob` as a runtime dependency, used only by the new `crawlPaths()` Node-native
crawl path ([src/crawler/crawlNode.ts](../../src/crawler/crawlNode.ts)) to enumerate files per doc-type glob
(with excludes applied the same way `withSpecmeshExclude` already merges them for the vscode path).

## Consequences

- New runtime dependency in `package.json`: `fast-glob`.
- `crawlNode.test.ts` (see FR-019's plan) should include at least one case exercising brace-list excludes, since
  that's the syntax most likely to differ subtly between glob library implementations.
- If `vscode.workspace.findFiles`'s glob semantics and `fast-glob`'s ever diverge on some pattern, that surfaces
  as the two entry points returning different results for the same repo — worth a quick manual cross-check the
  first time a repo's `.specmesh.yml` uses an unusual glob (e.g. deeply nested brace expansion) with both entry
  points.
