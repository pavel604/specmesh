# specmesh Charter

**Status**: Draft
**Date**: 2026-09-11

specmesh is a doc graph for tracking spec-driven development docs across a VS Code workspace and multiple
repos. This is the top-level "why" for specmesh. It should rarely change. For the "how" — the epic/FR
document hierarchy and which skill produces what — see [spec-driven-development.md](spec-driven-development.md).

## Problem

Git doesn't track files that span multiple git repos or directory trees, so a spec-driven development
lifecycle spread across a multi-root workspace has no way to see cross-repo doc links, spot broken ones, or
know when a doc an agent depends on disappears.

## Approach

- Crawl every open workspace folder's charter/epic/ADR/FR/reference/instructions/skill docs into one browsable
  tree (the Docs Explorer), without needing to know each repo's folder layout.
- Resolve relative cross-repo markdown links against the real filesystem and surface broken links, orphaned
  docs, and missing tracked files as VS Code diagnostics/tree entries instead of silent rot.
- Scaffold the spec-driven development structure itself (charter, SDD doc, epics, ADRs, reference docs,
  instructions, skills, per-repo config) so a product can adopt the lifecycle in minutes, never overwriting
  existing files.
- Expose the doc graph to Copilot Chat as Language Model Tools, so agent mode can query and extend it directly
  instead of a person running specmesh commands manually.

## Who this is for

Developers and AI coding agents working in multi-root VS Code workspaces who are following a spec-driven
development lifecycle (charter → epic → FR) split across multiple repos. They need one place to browse that
doc graph, trust that its cross-repo links are valid, and quickly spot orphaned or missing docs — none of
which plain git or a single-repo file explorer gives them today.

## Non-goals

- Not a general-purpose replacement for git — each child repo's own source code history/diffs/branches stay
  exactly where they are today, using that repo's own git and VS Code's built-in git integration, never
  reimplemented by specmesh. The one deliberate exception: doc files can additionally be tracked in a separate,
  detached commit history spanning multiple repos, because plain git has no mechanism of its own for that — see
  docs/roadmap.md for the mechanism.
- Not a hosted/cloud index — MVP is local-only; an aggregated cross-repo snapshot service is a deliberately
  deferred later phase.
- Not a general-purpose documentation or wiki tool — it only tracks the specific doc types used by the
  spec-driven development lifecycle (charter/epic/ADR/FR/reference/instructions/skills).

## Changelog

- 2026-09-16: Narrowed the "not a replacement for git" non-goal to source code history specifically, carving
  out an explicit exception for a detached, cross-repo doc commit history (see docs/roadmap.md).
- 2026-09-11: Initial mission drafted from README.md.
- 2026-09-15: Renamed mission.md to charter.md (clearer, more bounded name for this doc's purpose).
