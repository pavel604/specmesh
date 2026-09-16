# FR-008: Declarative Repo Manifest

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-16
**Epic**: [EPIC-003: Multi-Repo Documentation Tracking](../epics/EPIC-003-multi-repo-doc-tracking.md)

## User Story

As a specmesh user with a multi-repo workspace, I want to declare which child repos make up my product (name,
git remote, local path) directly in `.specmesh.yml`, so that "which repos exist" is an explicit, git-tracked fact
instead of something inferred from whichever folders happen to be open in my VS Code workspace.

## Overview

Adds an optional `repos:` list to `.specmesh.yml` (name/remote/path per entry) alongside the existing `track:`
list, parses and validates it, and surfaces each declared repo's on-disk presence (present/missing) so the
manifest is visibly useful immediately — before any future auto-clone or cross-repo doc-tracking automation
consumes it.

## Functional Requirements

- **FR-1**: `.specmesh.yml` supports an optional top-level `repos:` list. Each entry has `name` (string), `remote`
  (string, a git remote URL), and `path` (string, relative to the folder containing that `.specmesh.yml`).
- **FR-2**: `repoConfig.ts` parses `repos:` into the existing `RepoConfig` result alongside `track:`, exposed as a
  new typed field (e.g. `repos?: RepoManifestEntry[]`) plus a new `RepoManifestEntry` type in `src/model/types.ts`.
- **FR-3**: An entry missing `name`, `remote`, or `path` (or with a `path` that isn't a relative path) is treated
  as invalid: it's excluded from the parsed result and reported as a problem the user can see (reuse the existing
  `Problem`/diagnostics plumbing rather than a silent console warning).
- **FR-4**: For each valid declared repo, specmesh checks whether `path` exists on disk relative to the owning
  workspace folder, and surfaces a "declared but not present" indicator (diagnostic and/or Docs Explorer tree
  entry) — read-only status, no cloning happens in this FR.
- **FR-5**: Declared repos are queryable by the existing MCP/Language Model Tools surface (`src/tools/specmeshTools.ts`),
  so an agent can ask "what repos does this workspace declare" without parsing YAML itself.

## Out of Scope

- Actually cloning a declared-but-missing repo (`git clone`) — future roadmap item (see `docs/roadmap.md` Vector 3).
- Scaffolding/projecting docs into a newly cloned repo.
- The detached cross-repo doc-tracking mechanism itself (separate FR under this epic, built on ADR-002).
- Any UI for adding/editing `repos:` entries beyond hand-editing YAML (no form/wizard in this FR).

## Assumptions

- `repos:` is meaningful wherever it appears; specmesh doesn't need to know which folder is "the root" to parse
  it — whichever `.specmesh.yml` declares `repos:` gets its entries surfaced. In practice this will be the repo
  holding the charter/epics, but that's a convention, not an enforced rule.
- `path` is always relative (to the folder containing that `.specmesh.yml`); absolute paths are rejected as
  invalid per FR-3 rather than silently supported, to keep `.specmesh.yml` portable across machines/checkouts.
- "Declared but not present" surfaces via the same `Problem`/diagnostics model already used for missing tracked
  docs (`kind: "missing"`-style entry), rather than inventing a parallel notification mechanism.
- No JSON schema/IntelliSense validation for `repos:` in this FR — out of scope, matches how `track:` itself has
  no schema today.

## Open Questions

- None — scope is narrow enough that the above assumptions cover it.
