# FR-001: Manage .specmesh.yml and Create New Docs from the Docs Tree

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-11
**Epic**: [EPIC-001: Docs Explorer Authoring](../epics/EPIC-001-docs-explorer-authoring.md)

## User Story

As a developer, I want to see and modify a repo's `.specmesh.yml` from the specmesh Docs tree — visible as a
file within the workspace folder it controls — and I want to start a new tracked documentation file right from
the tree, so I don't have to leave the Docs Explorer to manage what specmesh tracks.

## Overview

Adds two authoring affordances to the existing read-only Docs Explorer: a pinned, always-visible
`.specmesh.yml` node under each workspace-folder entry (create-if-missing, open-to-edit), and an inline
"Add new…" action on each workspace-folder entry that scaffolds a new single-file tracked doc (ADR, reference,
epic, instructions, skill, or a repo's custom type) from a minimal template.

## Functional Requirements

- **FR-1**: Each workspace-folder node in the specmesh Docs tree shows a pinned `.specmesh.yml` leaf item
  directly under it (a sibling of the doc-type category nodes, not nested inside one), regardless of whether
  the file currently exists.
- **FR-2**: Clicking an existing `.specmesh.yml` node opens it in the standard text editor (plain YAML editing,
  VS Code's built-in git decorations apply via `resourceUri`, same pattern already used for doc nodes).
- **FR-3**: If a folder has no `.specmesh.yml` yet, the pinned node is visually distinguished (e.g. a "not
  created" description/dimmed icon) and its command creates one instead of opening it, seeded with the same
  built-in-default `track:` content `scaffoldSdlc` already generates for a non-root repo.
- **FR-4**: Each workspace-folder node gets an inline "Add new…" toolbar action that quick-picks among that
  folder's currently resolved single-file doc types (its `.specmesh.yml` `track` list, or the built-in defaults
  if it has none) — e.g. ADR, Reference, Instructions, Skill, or any custom type from that repo's config.
- **FR-5**: "Epic" is offered as an addable type only for the folder that resolves an `epic` doc type (the
  mission/epic root repo), not every folder.
- **FR-6**: Choosing a doc type prompts for a title, derives the next sequential zero-padded number when the
  type's glob contains a numbered wildcard (e.g. `ADR-*.md`, `EPIC-*.md`), writes a minimal file (`# <Title>`
  heading + a `**Status**: Draft` line) at the resolved path, and opens it in the editor.
- **FR-7**: The "Add new…" list never includes FR spec/plan/tasks/walkthrough doc types — creating those stays
  exclusively owned by the `/new-feature` skill.
- **FR-8**: After creating a `.specmesh.yml` or a new doc file, the Docs tree refreshes automatically (reusing
  the existing crawl/refresh pipeline) so the new file shows up without a manual refresh.

## Out of Scope

- A custom form/editor UI for `.specmesh.yml` fields — editing happens via the normal text editor.
- Creating the FR spec+plan+tasks+walkthrough multi-file flow — owned by `/new-feature`.
- Renaming, renumbering, or deleting existing tracked docs.
- Multi-select/bulk doc creation.

## Assumptions

- "the folder it controls" means the workspace-folder root the `.specmesh.yml` lives in (per-repo config),
  matching the existing crawler's one-config-per-workspace-folder model — not a per-category concept.
- A newly created `.specmesh.yml`'s seed content reuses `scaffoldSdlc`'s existing non-root template
  (`getBuiltinDefaultDocTypes()`), so behavior stays consistent with the existing scaffold command.
- Sequential numbering for `New <Type>` reuses the same zero-padded, 3-digit convention already used for
  FR/EPIC folders (e.g. `ADR-004-...`).
- The "mission/epic root" folder (for FR-5) is determined by whichever folder's resolved doc types include
  `epic` — no separate config flag is introduced to mark a root.

## Open Questions

- None — no scope-blocking ambiguity remains after the options discussion.
