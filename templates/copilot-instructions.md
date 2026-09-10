# Workspace structure

{{REPO_LAYOUT}}

# Spec-driven development

Why this product exists: [docs/mission.md]({{MISSION_DOC_REL}}). How mission → epic → FR work breaks down and
which skill produces what: [docs/spec-driven-development.md]({{SDD_DOC_REL}}).

# Coding guidelines

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, propose it. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

## 4. Check for build/lint errors

Check for errors before calling it done when you edit code files. <!-- Add this product's build/test command(s)
here, e.g. "run `npm test`" or "run the X build task". -->
