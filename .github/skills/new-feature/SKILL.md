---
name: new-feature
description: 'Use when the user asks to start, spec, or build a new feature from a user story (e.g. "/new-feature ...", "build a feature that...", "I need a feature where..."). Orchestrates the full path from idea to PR-ready code in one continuous conversation: draft a spec, get it approved, draft an implementation plan, get it approved, break it into tasks, implement them, then present a review walkthrough. Does not stop and wait for separate commands between phases.'
argument-hint: 'A user story or feature description, e.g. "As a user, I want to..."'
---

# New Feature (idea → PR-ready code)

A single, continuous workflow. Once the user invokes this skill with a feature description, drive it all the way through the phases below **in this same session** — do not ask the user to run another command to continue. Only stop at the two explicit approval gates (end of Phase 1, end of Phase 2). Everything else proceeds automatically.

## Repo layout for this workspace

- `specmesh` — charter/epic root

Determine which repo(s) the feature touches from the description. If genuinely ambiguous, ask the user once before
Phase 1. Otherwise make the reasonable call and proceed.

## Phase 0 — Setup

1. The text after `/new-feature` (or the user's message describing the feature) is the feature description. If empty,
   ask the user for it — do not guess a feature out of nothing.
2. Derive a short-name (2-4 words, kebab-case) from the description.
3. Pick the primary target repo. Set `DOCS_DIR` to `<target-repo>/docs/`. If more than one repo is touched, the
   feature folder lives in whichever repo owns the primary user-facing change; mention the other repo's files in
   the plan/tasks regardless.
4. Scan `DOCS_DIR` for existing `FR-###-*` folders, take the highest `###`, and use the next sequential number
   (zero-padded to 3 digits) — e.g. `FR-004-claim-notes`. If `docs/` doesn't exist yet, create it and start at
   `FR-001`.
5. Read `docs/charter.md` and list the epics under `docs/epics/EPIC-###-*.md`. Pick the epic this
   feature clearly belongs to. If more than one is plausible, or none fit, ask the user once (offer the existing
   epics plus "new epic" as options) — do not silently guess a cross-cutting theme. If the user asks for a new
   epic, create `docs/epics/EPIC-<next-num>-<short-name>.md` (same structure as the existing epic docs)
   before continuing. Purely cross-cutting technical work (auth, project structure, data-access conventions) does
   not need an epic — only user/business-facing capability work does.
6. Set `FEATURE_DIR` to `DOCS_DIR/FR-<num>-<short-name>/`. This is revision 1 (`v1`) of the feature. All artifacts
   live in this one folder, suffixed with the revision number:
   - `FEATURE_DIR/spec.v1.md`
   - `FEATURE_DIR/plan.v1.md`
   - `FEATURE_DIR/tasks.v1.md`
   - `FEATURE_DIR/walkthrough.v1.md`

   Later drift (bugs, requirement changes) is handled by the separate `change-request` skill, which adds `v2`, `v3`,
   etc. to this same folder — see that skill's SKILL.md. This skill only ever creates `v1`.

## Phase 1 — Spec (Draft → Approved)

1. Read relevant existing code (semantic search / grep) only as much as needed to ground the spec in real
   terminology already used in the codebase (entity names, page names, etc.) — don't over-explore.
2. Write `FEATURE_DIR/spec.v1.md` using this structure:

   ```markdown
   # FR-<num>: <Feature Title>

   **Revision**: 1
   **Status**: Draft
   **Repos**: <repo(s) touched>
   **Created**: <date>
   **Epic**: [EPIC-<num>: <Epic Title>](<relative path to docs/epics/EPIC-<num>-\*.md>)

   ## User Story

   <the story, cleaned up>

   ## Overview

   <1-3 sentences: what this feature does and why>

   ## Functional Requirements

   - **FR-1**: <testable requirement>
   - **FR-2**: <testable requirement>
     ...

   ## Out of Scope

   - <explicitly excluded things, if any>

   ## Assumptions

   - <reasonable defaults you picked instead of asking>

   ## Open Questions

   - <only if something truly blocks scoping — max 2-3>
   ```

3. Make informed guesses for ambiguous details and record them under Assumptions. Only surface an Open Question if
   it materially changes scope and has no reasonable default (max 2-3 total).
4. Present the drafted spec content to the user (either inline in chat, or point at `spec.v1.md`).
5. **Gate.** Use the ask-questions tool: header "Spec Review", question "Approve this spec, or make changes?",
   options `Approve` / `Decline` / `Refine` (allow freeform input). Do not proceed on an ordinary chat reply like
   "looks good" — always use this structured prompt.
   - **Approve** → proceed to Phase 2.
   - **Refine** → treat the freeform text as the requested edits, update `spec.v1.md`, and ask this same gate again.
   - **Decline** → stop here; tell the user the feature is paused in `Draft` status and take no further action.
6. On approval, update the `Status` field in `spec.v1.md` to `Approved`.

## Phase 2 — Implementation Plan (Draft → Approved)

1. Explore the actual codebase in the target repo(s) — relevant components/pages, services, controllers, models,
   data-access code, etc. — enough to ground the plan in real files and existing patterns/conventions.
2. Write `FEATURE_DIR/plan.v1.md`. Group the work into topic-based `### <Title>` subsections (by layer, model,
   or feature area — whatever grouping fits the change), each opening with a brief functional description before
   its file list:

   ```markdown
   # Implementation Plan: FR-<num> <Feature Title> (v1)

   **Status**: Draft

   ## Approach

   ### <Change Title — e.g. "Extend Task model with due dates">

   <1-3 sentences: what this change introduces or fixes, and why — not just which files, the actual
   functionality/behavior being added>

   **Files:**

   - <path> — <what changes>

   ### <Next Change Title>

   <same: functional description first, then files>

   **Files:**

   - <path> — <what changes>

   ## Sequencing

   <order of work / dependencies between steps>

   ## Risks / Tradeoffs

   - <anything worth flagging>
   ```

3. Present the plan to the user (point at `plan.v1.md`).
4. **Gate.** Use the ask-questions tool: header "Plan Review", question "Approve this implementation plan, or make
   changes?", options `Approve` / `Decline` / `Refine` (allow freeform input). Do not proceed on an ordinary chat
   reply — always use this structured prompt.
   - **Approve** → proceed to Phase 3 and start building.
   - **Refine** → treat the freeform text as the requested edits, update `plan.v1.md`, and ask this same gate again.
   - **Decline** → stop here; tell the user the feature is paused with the plan in `Draft` status.
5. On approval, update the `Status` field in `plan.v1.md` to `Approved`.

## Phase 3 — Tasks

1. Break the approved plan into an ordered, checkbox task list. Write `FEATURE_DIR/tasks.v1.md`:

   ```markdown
   # Tasks: FR-<num> <Feature Title> (v1)

   - [ ] T1 — <task, tied to a specific file/change>
   - [ ] T2 — <task>
         ...
   ```

2. Briefly show the task list to the user for visibility, then **proceed automatically to Phase 4** — no approval
   gate here.

## Phase 4 — Implementation

1. Execute the tasks in `tasks.v1.md` in order using normal editing tools. Follow this workspace's existing
   conventions (matching any relevant `.instructions.md` files, existing patterns in neighboring files, etc.).
   Consult `plan.v1.md` for the approved approach.
2. Keep changes surgical — only what the task requires.
3. Check for build errors after edits and fix them before moving to the next task.
4. Mark each task `[x]` in `tasks.v1.md` as it completes.
5. Do not commit or push — leave the working tree for the user to review and commit themselves.
6. This phase may be re-entered from Phase 5 with newly appended fix tasks (see below) — that's expected and is
   still v1 work, not a new revision.

## Phase 5 — Review Walkthrough (loop until it actually works)

1. Write or update `FEATURE_DIR/walkthrough.v1.md`:

   ```markdown
   # Walkthrough: FR-<num> <Feature Title> (v1)

   ## Files Changed

   - <path> — <what changed and why, mapped back to the task(s) that produced it>

   ## Build/Test Results

   <summary>

   ## Follow-ups / Known Gaps

   - <if any>
   ```

2. Present the walkthrough to the user in chat.
3. **Gate.** Use the ask-questions tool: header "Walkthrough Review", question "Does this work as expected when you
   run it, or did you hit a problem?", options `Works as expected` / `Found a problem` (allow freeform input).
   - **Works as expected** → proceed to step 4.
   - **Found a problem** → this is still `v1`, not drift on a shipped feature — do **not** invoke `/change-request`
     and do **not** write `spec.v2.md`. Instead: append the fix as a new checkbox task at the end of
     `tasks.v1.md`, go back to Phase 4 to implement it, then return to this gate. Repeat as many times as needed.
4. Update the parent epic doc's Stories table (`docs/epics/EPIC-<num>-*.md`) — add/update the row for this
   FR with a link and `Done` status.

## Notes

- If the user rejects something at any point (spec, plan, or the final walkthrough), loop back within that phase —
  update the relevant file in `FEATURE_DIR` and re-present — rather than restarting from Phase 0.
- One folder per feature (`FEATURE_DIR`), one file per stage per revision (`spec.vN.md`, `plan.vN.md`,
  `tasks.vN.md`, `walkthrough.vN.md`). Don't create spec-kit-style scaffolding beyond this (no `specs/`, no
  checklists/, no hooks).
- A bug fix or requirement change against an **already-shipped** feature is not a new `/new-feature` invocation —
  use `/change-request` against the existing `FEATURE_DIR` instead, which adds the next revision (`v2`, `v3`, ...).
- **Hard rule**: All follow-up fixes and changes to newly-created and uncommitted `vN` files must be applied directly to those files. In other words, no `v2` gets created until `v1` has been committed at least once. Until then — whether the bug
  surfaces during this same session's Phase 5 loop, or the user comes back later and reaches for `/change-request`
  — the fix always lands directly in the existing `spec.v1.md` / `plan.v1.md` / `tasks.v1.md` /
  `walkthrough.v1.md` files. `/change-request` itself enforces this with a mandatory gate, so don't route the user
  there if you already know `v1` is uncommitted.
