# Spec-Driven Development (the "how")

This is the process/documentation methodology used to go from the [mission](mission.md) (the "why") to shipped
code. Keep business rationale out of this doc — it belongs in `mission.md`. Keep this doc process-only.

## Repo layout

{{REPO_LAYOUT}}

## Artifact hierarchy

```
Mission (docs/mission.md — one per product, rarely changes)
  └─ Epic (docs/epics/EPIC-###-*.md — a theme/capability, may span multiple repos)
       └─ FR (<repo>/docs/FR-###-*/spec.vN.md + plan/tasks/walkthrough — one buildable story)
            └─ Reference (<repo>/docs/reference/*.md — externally-owned schema/data snapshot the FR depends on)
```

Orthogonal to this chain: **ADRs** (`<repo>/docs/adr/ADR-###-*.md`) record cross-cutting technical decisions.
They don't hang off an epic or FR — they're referenced _from_ FR specs/plans when a story touches that technical
area. ADRs can cite the same Reference doc an FR does — it's shared, not owned by either.

**Reference docs** (`<repo>/docs/reference/*.md`) are a third, narrower artifact: a non-authoritative snapshot of
an _externally-owned_ schema or data vocabulary — just the tables/columns/codes a specific FR actually touches,
not a full data dictionary. They exist because this fact-lookup content is neither a decision (ADR) nor a
behavior spec (FR) — it's the ground truth an FR's requirements and an ADR's context both need to cite without
duplicating.

## Who creates what, and when

| Artifact                            | Created by                                                                      | Cadence                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Mission                             | Human, agent-assisted                                                           | Once; edited only when the product's core problem/approach changes                              |
| Epic                                | `new-feature` Phase 0 (asks which epic, or to create one), or authored directly | When a new capability theme emerges                                                             |
| FR spec/plan/tasks/walkthrough (v1) | `/new-feature`                                                                  | One per story                                                                                   |
| FR revision (v2, v3, ...)           | `/change-request`                                                               | On bug/requirement drift against a shipped FR                                                   |
| Reference                           | Authored directly, while drafting the FR/ADR that needs it                      | When a feature first depends on an externally-owned schema; updated only if that schema changes |
| ADR                                 | Authored directly when a technical decision is made                             | Independent of the epic/FR flow                                                                 |

## Rules

- Every new FR names the epic it belongs to (`**Epic:**` line in the spec header), unless the work is purely
  cross-cutting technical plumbing — that stays ADR-only, no epic needed.
- Don't retrofit an epic for one-off technical work just to satisfy the hierarchy — see Non-goals below.
- When an FR or ADR depends on an externally-owned schema, capture the table/column/vocabulary facts once in
  `docs/reference/<topic>.md` and cross-link it from both — don't duplicate schema facts inline in the FR's
  Assumptions or the ADR's Context, and don't scope the reference doc beyond what that FR actually touches.
- `mission.md` stays strictly business-facing language (problem, approach, who it's for, non-goals). No process
  mechanics, no skill names, no file-layout diagrams — those live here instead.
- **ADRs are immutable once Accepted.** If a decision changes, write a new ADR stating `Supersedes ADR-NNN` in
  its Context, and only flip the old ADR's `Status` line to `Superseded by ADR-MMM` — never rewrite its body. This
  mirrors how `/change-request` already treats FR spec revisions.
- **Mission and Epic docs are living documents, not versioned files** — no `v1`/`v2` file-per-revision like FRs.
  Edit them in place, but record every _material_ change (scope shift, dependency swap, a cited ADR getting
  superseded, etc.) as one dated bullet in a `## Changelog` section at the bottom. Routine story-completion
  updates to an epic's Stories table don't need a changelog entry — only changes to the epic's Outcome, Status,
  dependencies, or which ADR/tech underlies a building block.

## Doc hygiene at scale (avoiding documentation bloat)

More features/ADRs over time creates two different bloat risks — one taxes _every_ Copilot request, the other
only taxes exploration for one specific task:

- **Always-loaded context** — `copilot-instructions.md` and any `.instructions.md` file's `applyTo` scope. These
  load regardless of relevance, so keep them deliberately small:
  - `copilot-instructions.md` stays pointer-only (links, not inlined prose) — link to `mission.md`/this doc
    instead of restating them.
  - Keep `applyTo` globs as narrow as the actual topic. Widening a glob "to be safe" is the most common way this
    tier silently bloats — treat it as a real cost, not a free safety margin.
- **On-demand docs** (ADRs/FRs/reference docs) — cost is only paid when explored, but a feature under a
  well-populated epic shouldn't require reading the entire `docs/adr/` tree. When drafting or implementing a
  feature under an epic, read that epic's own linked ADRs/FRs/reference docs first, and only branch out further
  if a real, specific gap is found — don't proactively re-survey the whole doc library "just in case."
- **One decision per new ADR.** A new ADR should cover exactly one decision, so it stays small and independently
  supersedable.
- **Archive, don't just flag, once superseded.** Once an ADR's `Status` is flipped to `Superseded by ADR-MMM`
  (per the Rules above), move the file under `docs/adr/superseded/` so default exploration doesn't have to filter
  dead decisions out of every search — the link from the new ADR still resolves either way.

### Signals worth checking periodically

- Any `.instructions.md` or `copilot-instructions.md` growing past roughly one screen.
- An ADR with more than 1-2 `## Decision` headings (a sign it should have been split when it was written).
- An ADR, FR, or reference doc not linked from _any_ epic or FR — undiscoverable via the hierarchy, dead weight.
- An ADR left `Proposed`/`Accepted` long after the decision it describes has actually changed elsewhere.

### How this interacts with "touch only what you must"

These are **trigger-based** rules, not a license to proactively clean up existing docs. They apply at the moment
a document is being created or genuinely revised for its own reason — never as a speculative refactor of
something that already works.

## Non-goals

- This doc doesn't replace `new-feature`/`change-request`'s own `SKILL.md` — those own the step-by-step mechanics
  (gates, file templates, phases). This doc only explains how the artifact _types_ relate to each other.
