# Roadmap: Multi-Harness & Multi-Pattern Support

**Status**: Draft
**Created**: 2026-09-14

Pre-epic scratch space for two development vectors under discussion for specmesh (see [charter.md](charter.md)
for the product's current "why"). Not part of the formal charter → epic → FR hierarchy in
[spec-driven-development.md](spec-driven-development.md) — this doc exists to capture direction before it's
broken into real epics/FRs, and can be deleted or archived once that happens.

## Current coupling points (baseline analysis)

specmesh already separates an **engine** layer (crawler → graph → tree/diagnostics/tools, mostly pattern-agnostic
via `DocTypeDefinition` + per-repo `.specmesh.yml`) from a **convention** layer that is hardcoded to today's one
documentation pattern and one agent harness:

- [src/crawler/graph.ts](../src/crawler/graph.ts) `ORPHAN_CHECK_TYPES` — a pattern-specific rule (which doc
  types are "roots") baked into code instead of declared as data on `DocTypeDefinition`.
- [src/scaffold/scaffold.ts](../src/scaffold/scaffold.ts) + `templates/` — one hardcoded template set
  (charter/SDD/epics + `.github/skills/{new-feature,change-request}` + `.github/copilot-instructions.md`). No
  pattern or harness selection exists.
- Agent exposure is 100% GitHub Copilot Chat's API (`languageModelTools` contribution + `vscode.lm.registerTool`),
  and skill/instructions files live at Copilot-specific paths with Copilot-specific mechanics named directly in
  the prose (e.g. "Use the ask-questions tool").

## Vector 1 — Multi-harness support (Claude Code, Antigravity, others)

- **Extract an MCP server** wrapping the crawler/graph read-path (already nearly pure TS). One implementation,
  consumable by any MCP-aware harness (Claude Code, Claude Desktop, and Copilot itself via VS Code's MCP support)
  instead of N bespoke adapters. Keep `vscode.lm.registerTool` as a thin wrapper over the same core functions so
  behavior never diverges between the two entry points.
- **Introduce a "harness" concept** parallel to documentation patterns: scaffold prompts "which agent harness(es)?"
  and each harness is a small mapping of `{instructions file path+format, skills dir, tool-exposure method}`.
  Support scaffolding for multiple harnesses at once (see Cross-harness collaboration below).
- **Skill content is more portable than it looks.** Anthropic's public "Agent Skills" `SKILL.md` format
  (name/description frontmatter) is already close to what specmesh emits; both Claude Code and Copilot understand
  it. The gap is file location (`.github/skills/` vs `.claude/skills/`) and a few Copilot-specific phrases that
  should become harness-neutral (e.g. "ask the user to approve" instead of naming a specific tool).
- Consider emitting the emerging cross-tool `AGENTS.md` convention as a lowest-common-denominator instructions
  file for harnesses without their own bespoke format.
- **Open question, not yet verified:** Antigravity's actual extension/config model (VS Code-fork running standard
  extensions? Its own agent-config format? Both?). Don't design blind — confirm before committing to specifics.
- **Sequencing:** MCP extraction first (additive, doesn't touch the existing Copilot path), then harness-specific
  scaffolding once pattern packs (Vector 2) exist, since a harness becomes just another render target for the
  same canonical skill content.

## Vector 2 — Multiple/custom documentation patterns

- **Promote "documentation pattern" to a first-class pack**: `{docTypes[], scaffold templates, skill(s)}`. Ship
  today's charter/epic/FR shape as the built-in `spec-driven-dev` pack; add others (Google-style PRD/Design-Doc/
  RFC) as siblings.
- **Move the orphan-root rule into data**: add `root?: boolean` (and possibly `versioned?: boolean` for vN-style
  docs like FR spec/plan/tasks vs. living docs like charter/ADR) to `DocTypeDefinition`, so
  `ORPHAN_CHECK_TYPES` becomes "everything except `root: true`" instead of a type-name allowlist in code.
- **Make scaffold.ts pattern-driven**: read docTypes + templates from a folder per pattern instead of one
  hardcoded template set; prompt "which pattern?" the same way it already prompts "which repos."
- **Support fully custom packs**: a local folder (e.g. `.specmesh/patterns/<name>/` with a manifest + templates)
  that scaffold discovers alongside built-ins — incremental on top of the existing `.specmesh.yml` `track:`
  override, not a rewrite.
- **Composes with Vector 1**: keep a pack's skill prose harness-neutral; the per-harness renderer from Vector 1
  turns one pack into `.github/skills/...`, `.claude/skills/...`, etc. — avoids N patterns × M harnesses turning
  into hand-maintained files.

## Cross-harness collaboration on the same project

**Question:** can a team split across harnesses (e.g. one org's team on GitHub Copilot, another's on Claude)
collaborate seamlessly on the same specmesh-tracked repo, just by configuring specmesh?

**Short answer: yes, but "simply configuring" undersells what has to be true first.** The doc graph itself
(charter/epic/FR/ADR markdown files) is already harness-agnostic and git-tracked today — both a Copilot user and
a Claude user read/write the same files with zero extra effort, since the engine layer never asks who's editing.
What's missing is everything both vectors above are already proposing:

1. **Both harnesses' files must coexist in the repo.** Scaffold needs to support emitting for multiple harnesses
   in one run (`.github/copilot-instructions.md` + `.github/skills/*` *and* `CLAUDE.md` + `.claude/skills/*`
   side by side), not force a single choice per repo.
2. **One canonical process, rendered per harness.** If each harness's skill file is hand-authored independently,
   they will drift (different numbering logic, different gate behavior). Author the skill's process semantics
   once, harness-neutral, and render it per harness — otherwise a Copilot-authored FR and a Claude-authored FR
   could silently follow different rules.
3. **Query results must match regardless of who asks.** The MCP server (for Claude) and the VS Code LM tool (for
   Copilot) must call into the same core module, not two independently-maintained implementations, or the two
   teams could get subtly different answers to "which docs are orphaned" etc. Worth a parity test between the
   two entry points.
4. **Shared config, not per-person config.** `.specmesh.yml` and the chosen pattern pack are already repo-level,
   git-tracked decisions — this is the right place for the pattern/doc-type choice to live so it's made once for
   the whole team, not per harness or per person.
5. **Numbering/merge conflicts are a real but familiar risk.** Two people on different branches both creating the
   "next" FR-004 is the same class of conflict as two humans opening PR #104 at once — not new, but worth naming
   so it isn't mistaken for a specmesh bug.
6. **Tool-capability mismatches need graceful degradation.** Copilot and Claude Code don't expose identical
   approval/gate UX. A rendered skill should assume only a lowest-common-denominator interaction (e.g. "ask a
   yes/no question") rather than a specific tool that only one harness has.

None of this is exotic — it's the same "single source of truth, N renderers/adapters" principle already proposed
for both vectors, applied consistently. The net-new risk unique to *simultaneous* multi-harness use (vs. picking
one harness) is drift between renderings and subtly different query results — both addressable with a
"regenerate harness files from canonical source" command and parity tests between the MCP server and the LM tool,
rather than anything architecturally blocking.

## Vector 3 — Declarative repo manifest & auto-clone

- **Extend the root `.specmesh.yml` with a `repos:` list** — name/remote/path per child repo, e.g.:
  ```yaml
  repos:
    - name: "Blazor Server"
      remote: git@github.com:acme/webapp.git
      path: ./web
  ```
  Makes "which repos make up this workspace" an explicit, git-tracked fact instead of something inferred from
  VS Code's multi-root workspace folders or filesystem `.git` discovery.
- **Auto-clone**: if a declared repo's `path` doesn't exist yet, specmesh can clone it on demand — "open this
  workspace" becomes "get a fully populated multi-repo checkout" with no manual `git clone` per child repo.
- **Project docs onto newly-cloned repos**: once a declared repo is cloned, reuse the existing scaffold/pattern-
  pack machinery ([src/scaffold/newDoc.ts](../src/scaffold/newDoc.ts), [src/scaffold/patterns.ts](../src/scaffold/patterns.ts))
  to seed it with whichever doc types apply, rather than inventing a separate projection mechanism.
- **Relationship to cross-repo doc tracking**: `repos:` is also the natural enumeration source for the separate
  cross-repo doc-tracking mechanism under discussion (a detached, git-plumbing-based central history spanning all
  child repos) — it replaces "discover nested repos by walking for `.git` dirs" with an explicit, authored list,
  and supplies the per-repo `path` that mechanism needs for its one-time `git rm --cached` / `.gitignore`
  migration.
- **Sequencing**: additive to today's per-workspace-folder loading in [repoConfig.ts](../src/crawler/repoConfig.ts)
  — a single root config can describe multiple repos before any auto-clone/UI work exists, so the schema can land
  ahead of the clone behavior itself.

Eventual TODO's:
- Auto-cloning declared repos (future roadmap item, not this FR).
- Pushing `.specmesh/spec.git` to a remote or configuring one — left to the user's own `git` commands against
  that git-dir.
- Conflict resolution between simultaneous edits to the same doc from two machines/branches.
- A dedicated tree-view UI for central-repo status beyond the output-channel log in FR-10.
- Extending central tracking to arbitrary multi-root VS Code workspace folders that aren't declared via `repos:`
  — see Assumptions.
- Fully tearing down `.specmesh/spec.git` (deleting it outright, discarding all central history) is not a
  dedicated command — a user who wants that can delete `.specmesh/` manually. FR-8 (Untrack) deliberately
  preserves history instead.


## Open questions

- Antigravity's real extension/config model — needs research before designing its harness adapter.
- Whether to standardize on `AGENTS.md` as a fallback, or only emit it when no dedicated harness is selected.
- Where "regenerate harness files" should live: a command, a watcher, or a manual `specmesh: sync` action.

## Next steps

- Turn Vector 1 and Vector 2 into epic(s)/FR(s) via the `new-feature` workflow.

## Changelog

- 2026-09-16: Added Vector 3 (declarative `repos:` manifest & auto-clone).
- 2026-09-14: Initial roadmap drafted from brainstorming session.
