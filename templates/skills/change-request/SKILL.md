---
name: change-request
description: 'Use when a bug is found or a requirement changes for an ALREADY-SHIPPED feature that has an FR folder under docs/ (e.g. "/change-request ...", "FR-003 needs to change", "this is broken, the spec needs updating"). Creates the next revision (v2, v3, ...) of that feature spec/plan/tasks/walkthrough, tracking exactly what changed and why, then implements the delta. Does not create a new FR folder — use new-feature for that.'
argument-hint: "Which feature (FR number or folder name) plus what changed/broke and why"
---

# Change Request (requirement drift on an existing feature)

Handles drift on a feature that already has a `FEATURE_DIR` (created by `new-feature`). Every drift event becomes a
new numbered revision (`v2`, `v3`, ...) inside that same folder — never a new FR folder, never an edit to a prior
revision's body. Same continuous-session behavior as `new-feature`: don't stop between phases except at the two
approval gates.

**Hard rule, checked before anything else below**: a new revision (`v{NEW_REV}`) may only be created for a feature
that has been committed at least once. If `v{CURRENT_REV}` has never been committed, there is nothing to "revise" —
edit `spec.v{CURRENT_REV}.md` / `plan.v{CURRENT_REV}.md` / `tasks.v{CURRENT_REV}.md` /
`walkthrough.v{CURRENT_REV}.md` directly in place instead. Do not infer commit status yourself (git history can be
ambiguous or absent) — always ask, per the mandatory gate in Phase 0 step 3.

## Phase 0 — Locate the feature & the trigger

1. Resolve `FEATURE_DIR`: match the user's reference (FR number, folder name, or description) to an existing
   `<repo>/docs/FR-<num>-<short-name>/`. If you can't find a confident match, ask the user to point at the right
   folder — do not create a new one.
2. Scan `FEATURE_DIR` for the highest existing `spec.vN.md`. That's `CURRENT_REV`. Set `NEW_REV = CURRENT_REV + 1`.
3. **Gate — mandatory, ask before doing anything else in this skill.** Use the ask-questions tool: header "Shipped
   Check", question "Has FR-<num> v{CURRENT_REV} been committed at least once (ideally pushed/merged), or is it
   still uncommitted work?", options `Committed` / `Still uncommitted` (allow freeform input). Do not skip this by
   assuming from context — ask every time, even if a prior message in this conversation implied an answer.
   - **Still uncommitted** → stop. This is not a change request. Tell the user you'll instead edit
     `spec.v{CURRENT_REV}.md` / `plan.v{CURRENT_REV}.md` / `tasks.v{CURRENT_REV}.md` /
     `walkthrough.v{CURRENT_REV}.md` directly (same version, no `Revision`/`Status` bump), append the fix to
     `tasks.v{CURRENT_REV}.md`, implement it, and update `walkthrough.v{CURRENT_REV}.md`'s results — then end this
     skill invocation. Do not create any `v{NEW_REV}` file.
   - **Committed** → continue to step 4.
4. Determine the trigger: **Bug** (the code doesn't match the approved spec) or **Change Request** (the approved
   requirement itself is changing). Ask once if it's not obvious from the user's message.
5. Capture the reason in one sentence — this is mandatory even for small bugs, it becomes part of the revision
   header.

## Phase 1 — Revise the spec (Draft → Approved)

The revision is **delta-only** — it does not repeat anything unchanged from `spec.v{CURRENT_REV}.md`. Write
`spec.v{NEW_REV}.md`:

```markdown
# FR-<num>: <Feature Title>

**Revision**: {NEW_REV} (supersedes v{CURRENT_REV})
**Date**: <date>
**Trigger**: Bug | Change Request
**Reason**: <one sentence — why this revision exists>
**Status**: Draft
**Full spec**: see [spec.v{CURRENT_REV}.md](./spec.v{CURRENT_REV}.md) — only what changed is listed below

## Revision Summary

- <item> — <one-line why>

## <Section Name> Changed

- ~~old wording~~ **Now:** new wording
```

1. Include a `## <Section> Changed` block **only** for sections that actually changed (`User Story`, `Functional
Requirements`, `Out of Scope`, `Assumptions`, `Open Questions`, etc.) — omit every section that didn't change.
2. Within an included section, list **only** the changed/added/removed items, each marked up in place:
   `~~old wording~~ **Now:** new wording` (or `(new)` / `(removed)` for additions/removals). Do not re-list
   unaffected items from that section.
3. In `spec.v{CURRENT_REV}.md`, change only its `Status` field to `Superseded by v{NEW_REV}` — never touch its body.
4. Present the revised spec (point at `spec.v{NEW_REV}.md`).
5. **Gate.** Use the ask-questions tool: header "Spec Review", question "Approve this spec revision, or make
   changes?", options `Approve` / `Decline` / `Refine` (allow freeform input). Do not proceed on an ordinary chat
   reply — always use this structured prompt.
   - **Approve** → proceed to Phase 2.
   - **Refine** → treat the freeform text as the requested edits, update `spec.v{NEW_REV}.md`, and ask this same gate
     again.
   - **Decline** → stop here; tell the user the revision is paused in `Draft` status and take no further action.
6. On approval, set `spec.v{NEW_REV}.md` `Status` to `Approved`.

## Phase 2 — Migration plan (Draft → Approved)

This is delta-only — do not restate the whole implementation plan. Write `plan.v{NEW_REV}.md`:

```markdown
# Migration Plan: FR-<num> v{CURRENT_REV} → v{NEW_REV}

**Status**: Draft

## Changes to Apply

### <Change Title — e.g. requirement ID or short label>

<1-3 sentences: old behavior → new behavior, and why — not just which files, the actual functionality/fix
being introduced>

**Files:**

- <path> — <what changes>

## Sequencing / Risks

- <notes>
```

Group changes into topic-based `### <Title>` subsections, each opening with a brief functional description
before its file list. Only explore the code paths implicated by the changed requirements — do not proactively
re-scan the rest of the codebase for unrelated inconsistencies. Present the plan (point at `plan.v{NEW_REV}.md`).

**Gate.** Use the ask-questions tool: header "Plan Review", question "Approve this migration plan, or make changes?",
options `Approve` / `Decline` / `Refine` (allow freeform input). Do not proceed on an ordinary chat reply — always
use this structured prompt.

- **Approve** → proceed to Phase 3 and start building.
- **Refine** → treat the freeform text as the requested edits, update `plan.v{NEW_REV}.md`, and ask this same gate
  again.
- **Decline** → stop here; tell the user the revision is paused with the plan in `Draft` status.

On approval, set `Status` to `Approved`.

## Phase 3 — Migration tasks

Write `tasks.v{NEW_REV}.md`: an ordered checkbox list scoped strictly to the migration plan's "Changes to Apply"
subsections (and the files listed under each) — no unrelated cleanup tasks. Show the list, then **proceed
automatically to Phase 4** — no gate.

## Phase 4 — Implementation

1. Execute `tasks.v{NEW_REV}.md` in order, strictly scoped to what the migration plan named. If you notice unrelated
   issues while in these files, mention them to the user afterward rather than fixing them silently.
2. Check for build errors after edits and fix before moving on.
3. Mark tasks `[x]` as they complete. Do not commit or push.

## Phase 5 — Review walkthrough

Write `walkthrough.v{NEW_REV}.md`:

```markdown
# Walkthrough: FR-<num> <Feature Title> (v{CURRENT_REV} → v{NEW_REV})

## What Changed & Why

<pulled from the Reason + Revision Summary>

## Files Changed

- <path> — <what changed>

## Build/Test Results

<summary>

## Follow-ups / Known Gaps

- <if any>
```

Present it and ask if the user wants changes before they review the diff and commit/PR it themselves.

## Notes

- Revisions are additive and immutable once superseded — never edit a prior `vN` file's body, only its `Status`
  line.
- Repeated drift just keeps incrementing the revision number (v2, v3, v4, ...). `spec.v1.md` is the only full copy;
  every subsequent `spec.vN.md`, and every `plan.vN.md`/`tasks.vN.md`/`walkthrough.vN.md`, is delta-only — read the
  chain of prior revisions for full context rather than duplicating it.
- If the referenced feature has no `FEATURE_DIR` yet, stop and tell the user to use `/new-feature` instead of
  inventing one here.
- Never assume the shipped state from context or memory of an earlier message — the Phase 0 gate must be asked
  explicitly every time this skill runs, even on the Nth bug report against the same still-uncommitted `v1`.
