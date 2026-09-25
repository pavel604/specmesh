# FR-019: Standalone MCP Server for the Doc Graph

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-24
**Epic**: [EPIC-004: Multi-Harness Agent Support](../epics/EPIC-004-multi-harness-agent-support.md)

## User Story

As a developer using an MCP-aware agent harness other than GitHub Copilot Chat (e.g. Claude Code, Claude
Desktop), I want to query specmesh's tracked-doc graph (list docs, find broken links/orphans/missing files, get
doc links, list declared repos, get help) the same way a Copilot user does today, so my harness isn't a
second-class citizen for this workspace's spec-driven development process.

## Overview

Extract the read-only query logic behind today's 8 `languageModelTools` into a harness-agnostic core, and expose
it a second way: as a standalone MCP server (stdio transport) that any MCP client can connect to. The existing
`vscode.lm.registerTool` tools become thin wrappers over the same core, so behavior never diverges between the
two entry points.

## Functional Requirements

- **FR-1**: A new core module exposes the same 8 query operations as today's tools (`list_docs`,
  `find_broken_links`, `find_orphans`, `find_missing_docs`, `get_doc_links`, `list_repos`, `get_help`, and
  `update_track_entry`), taking explicit workspace-folder root paths instead of relying on
  `vscode.workspace.workspaceFolders`.
- **FR-2**: The core module's file discovery/reading uses Node's `fs`/a glob library instead of
  `vscode.workspace.findFiles`/`vscode.workspace.fs`, so it runs outside an extension host.
- **FR-3**: A new MCP server entry point registers all 8 operations as MCP tools (name, description, input
  schema mirroring today's `languageModelTools` contributions) and serves them over stdio via
  `@modelcontextprotocol/sdk`.
- **FR-4**: The MCP server accepts workspace-folder root path(s) as startup configuration (e.g. CLI args), since
  it has no VS Code workspace concept of its own.
- **FR-5**: Today's `vscode.lm.registerTool`-based tools in `src/tools/specmeshTools.ts` are refactored to call
  the same core module, so Copilot-facing behavior is unchanged (no user-visible regression) and never diverges
  from the MCP-facing behavior.
- **FR-6**: The MCP server is buildable/runnable standalone (`npm run compile` output + a documented run
  command), independent of the VS Code extension activating.

## Out of Scope

- Per-harness scaffolding/rendering of `.claude/skills/*`, `CLAUDE.md`, `AGENTS.md`, or any other harness-specific
  instructions/skill files (roadmap Vector 1's later steps — separate FR once this lands).
- The `update_track_entry` write tool's "requires user confirmation" UX is Copilot-specific (VS Code's tool
  confirmation prompt); the MCP-exposed version is read-only-equivalent scope for this FR — see Assumptions.
- Antigravity or other harnesses' bespoke config formats — this FR only targets the standard MCP protocol itself.
- A parity/regression test asserting the two entry points never diverge beyond this FR's own test suite (e.g. a
  fuzz/property test) — out of scope; today's mirrored unit tests against the shared core are the parity
  guarantee.

## Assumptions

- `update_track_entry` (the one write/mutating tool) is exposed via MCP too, but without VS Code's built-in
  "requires confirmation" UX — the MCP client's own approval mechanism (most MCP hosts prompt before any tool
  call) is assumed sufficient, consistent with the tool's existing `modelDescription` note.
- The new MCP SDK dependency (`@modelcontextprotocol/sdk`) is not yet used anywhere in this repo and has no
  ADR — Phase 2 of this workflow will gate on that before the plan can rely on it.
- The MCP server ships as part of this same `specmesh` npm package (a new compiled entry point under `out/`),
  not a separate published package — matches the "one implementation, multiple consumers" framing in the
  roadmap, and avoids a second package.json/release pipeline.
- Workspace-folder roots are passed to the standalone server explicitly (e.g. CLI args or a small JSON config
  file) since MCP servers have no access to VS Code's `workspace.workspaceFolders`.

## Open Questions

- None — the roadmap already resolved the shape of this work; remaining unknowns are implementation details for
  the plan phase, not scope questions.
