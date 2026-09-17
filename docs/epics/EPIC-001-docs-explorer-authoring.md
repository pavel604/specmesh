# EPIC-001: Docs Explorer Authoring

**Status**: Active
**Created**: 2026-09-11

## Outcome

The Docs Explorer stops being a read-only viewer and becomes a lightweight authoring surface: a developer can
see and edit a repo's `.specmesh.yml` config and start new tracked docs (ADR, reference, epic, etc.) directly
from the tree, without hand-crafting file paths or leaving VS Code's Explorer view.

## Stories

| FR                                                                                             | Title                                                       | Status      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ----------- |
| [FR-001](../FR-001-docs-explorer-authoring/spec.v1.md) | Manage .specmesh.yml and Create New Docs from the Docs Tree | Done |
| [FR-002](../FR-002-docs-tree-status-row/spec.v1.md) | Fixed Docs Tree Status Row | Done |
| [FR-004](../FR-004-docs-explorer-actions-menu/spec.v1.md) | Docs Explorer Actions Menu | Done |
| [FR-005](../FR-005-docs-tree-problem-indicator/spec.v1.md) | Docs Tree Problem Indicator | Done |
| [FR-006](../FR-006-docs-tree-category-order/spec.v1.md) | Docs Tree Category Order | Done |
| [FR-013](../FR-013-docs-tree-nesting/spec.v1.md) | Docs Tree Nesting | Done |

## Dependencies

- Builds on the existing Docs Explorer tree (`specmesh.docsExplorer`) and `.specmesh.yml` config format.

## Changelog

- 2026-09-11: Epic created.
- FR-013 added nested rendering (FR plan/tasks/walkthrough docs nest under their matching spec doc).
