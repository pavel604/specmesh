# Changelog

All notable changes to the "specmesh" extension are documented in this file.

## [0.15.0] - 2026-09-22

- Add a live search filter to the Docs Explorer tree; fix `${workspaceFolder}` markdown link resolution
  false positives.

## [0.14.0] - 2026-09-21

- Added a Docs Dependency Graph View, toggleable alongside the existing tree view: renders tracked docs as
  nodes with markdown-link and doc-type nesting edges, isolates unlinked docs as strays, and supports
  pan/zoom, hover tooltips, and node labels.

## [0.13.0] - 2026-09-18

- Docs Explorer category lists (FR Specs, ADRs, etc.) now sort newest-first (by `Created`/`Date` front-matter)
  and cap at 10 visible docs by default, with a "Show N more…" row to expand to the full list.

## [0.12.1] - 2026-09-18

- Fixed high-severity `serialize-javascript`/`diff` transitive dev-dependency vulnerabilities (pulled in via
  `@vscode/test-cli`'s bundled `mocha`) by pinning safe versions tree-wide via `package.json` `overrides`. No
  runtime/shipped-extension code is affected — this only touches the test toolchain.

## [0.12.0] - 2026-09-18

- Add FR-014: declared-repo clone/sync automation — auto-prompt to clone newly declared `repos:` entries and to
  delete removed ones, a `specmesh: Sync/Clone Repos` command to retry failed clones, and auto-mirroring of the
  central spec repo's remote into `specRepoRemote`.

## [0.11.0] - 2026-09-17

- Docs Explorer now nests FR plan/tasks/walkthrough docs under their matching spec doc (same FR folder + version)
  instead of separate flat top-level categories, via a new `DocTypeDefinition.children` config option.

## [0.10.0] - 2026-09-17

- Added a central spec/doc git repo that spans multiple repos and projects a documentation layer onto them:
  stage, commit, undo last commit, switch/create branches, manage remotes (add/edit/remove), and push/pull/fetch
  — all from a dedicated "specmesh (central)" Source Control view.

## [0.9.3] - 2026-09-16

- Fixed a false broken-link flag for markdown links written inside inline code spans (backticks), e.g. template
  placeholder links shown in skill docs.

## [0.9.1] - 2026-09-15

- False orphan tweak

## [0.9.0] - 2026-09-15

- Document pack refactoring

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
