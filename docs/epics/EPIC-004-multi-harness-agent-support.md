# EPIC-004: Multi-Harness Agent Support

**Status**: Active
**Created**: 2026-09-24

## Outcome

specmesh's doc graph stops being reachable only through GitHub Copilot Chat's `languageModelTools` API. The same
crawl/graph/problem-detection logic is exposed through a standard MCP server, so any MCP-aware agent harness
(Claude Code, Claude Desktop, VS Code's own MCP support, etc.) can query it — without a second, independently
maintained implementation that risks drifting from the Copilot-facing tools.

## Stories

| FR  | Title | Status |
| --- | ----- | ------ |

## Dependencies

- Builds on the existing crawl/graph read-path in [src/crawler/crawler.ts](../../src/crawler/crawler.ts) and
  [src/crawler/graph.ts](../../src/crawler/graph.ts), and the existing tool set in
  [src/tools/specmeshTools.ts](../../src/tools/specmeshTools.ts).
- See [docs/roadmap.md](../roadmap.md) "Vector 1" for the full multi-harness discussion this epic is drawn from.
- Testing approach builds on [ADR-001](../adr/ADR-001-testing-strategy.md) (`@vscode/test-cli` + Mocha).

## Changelog

- 2026-09-24: Epic created.
