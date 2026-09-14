# Changelog

All notable changes to the "specmesh" extension are documented in this file.

## [0.8.1] - 2026-09-14

- Fixed: the Docs Explorer's "Scaffold Spec-Driven Development Structure" welcome prompt was hidden after
  crawling a workspace folder with no tracked docs/`.specmesh.yml`, because the always-populated status row
  suppressed VS Code's empty-view welcome content (FR-002 v2).

## [0.8.0] - 2026-09-14

- Docs Explorer category rows (Mission, Epics, ADRs, FR Specs, etc.) now render in the order they're listed in
  `.specmesh.yml`'s `track:` list, instead of a hardcoded order.

## [0.7.0] - 2026-09-14

- Docs Explorer folder/category rows now show a warning/error icon when they contain a broken link or missing
  tracked file; fixed a false-positive broken-link flag for markdown links shown inside fenced code-block
  examples.

## [0.6.0] - 2026-09-14

- Actions menu to show orphaned/missing and refresh the docs tree (FR-004)

## [0.5.0] - 2026-09-14

- EPIC-002: allow for custom doc sets via root metadata (FR-003)

## [0.4.0] - 2026-09-11

- Fixed status row in Docs Explorer tree (FR-002)

## [0.3.0] - 2026-09-11

- Add .specmesh.yml tree node, Add new/Delete Doc actions to Docs Explorer (FR-001)

## [0.2.0] - 2026-09-11

- Add release skill

## [0.1.0] - 2026-09-11

- Scaffold spec-driven development structure
