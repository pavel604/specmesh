---
name: release
description: 'Use when the user asks to cut/push a new version or tag for specmesh (e.g. "/release", "push a new version", "cut a release", "tag a new version"). Commits any staged changes, bumps package.json via semver, tags it, and pushes the commit+tag so the release.yml GitHub Actions workflow builds and publishes the VSIX as a GitHub Release.'
argument-hint: "Optional: patch/minor/major (defaults to patch), plus a one-line summary of what changed"
---

# Release (bump, tag, push)

specmesh has no separate publish step of its own: pushing a `v*.*.*` tag is what triggers
[.github/workflows/release.yml](../../workflows/release.yml) on GitHub Actions, which builds the VSIX
(`npm ci && npm run compile && npx @vscode/vsce package`) and uploads it as a GitHub Release asset. This skill
only needs to get a correctly bumped, tagged commit onto `origin`.

## Steps

1. Check `git status`. If there are staged/unstaged changes, ask the user to confirm they're ready to be part of
   this release (don't silently include unrelated in-progress work), then commit them with a plain descriptive
   message — don't invent a changelog.
2. Run `npm audit --audit-level=high`. If it reports any high/critical vulnerability, resolve it before touching
   version/tag/push — do not release with one outstanding. Prefer the least invasive fix that keeps `npm run
   compile`/`npm test` green: a `package.json` `overrides` entry pinning the flagged transitive package to a safe
   version is usually enough (see the `diff`/`serialize-javascript` overrides already in `package.json` for
   precedent) rather than `npm audit fix --force`, which can silently downgrade/replace a direct dependency.
   Commit the fix on its own before continuing.
3. Ask the user for the semver bump if not given: `patch` (default, bug fixes/small doc changes), `minor` (new
   user-facing capability, backward compatible), or `major` (breaking change). Infer a reasonable default from the
   diff being released, but confirm rather than guessing on anything that looks bigger than a patch. Also get a
   one-line (or few-bullet) summary of what changed if not already given — this becomes the changelog entry, don't
   invent one from the diff without the user's input.
4. Add a new section to the top of [CHANGELOG.md](../../../CHANGELOG.md), right under the title line, in
   [Keep a Changelog](https://keepachangelog.com/) style:

   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD

   - <summary bullet(s) from step 3>
   ```

   Use today's date and the version being released (not yet bumped in `package.json` at this point — compute it
   from the current version + the chosen bump). Commit it on its own (e.g. `git commit -am "docs: add vX.Y.Z
   changelog entry"`) — `npm version` refuses to run with ANY staged or unstaged changes present (not just
   files it touches itself), so the changelog entry cannot be staged-and-left for `npm version` to sweep up; it
   needs its own clean commit first.
5. Run `npm version <patch|minor|major> -m "chore: release v%s"` from the repo root. This bumps the `version`
   field in [package.json](../../../package.json), commits that one-line change, and creates an annotated git tag
   `vX.Y.Z` pointing at it — do not hand-edit `package.json`'s version or create the tag manually.
6. Push the commit and the tag together: `git push --follow-tags` (plain `git push` alone will NOT push the tag).
7. **Gate — mandatory, ask before this step.** Use the ask-questions tool: header "Push Release", question
   "Push commit + tag v<X.Y.Z> to origin now? This triggers a public GitHub Actions release build.", options
   `Push` / `Cancel` (allow freeform input for anything else, e.g. "wait" or a different tag). Do not push without
   an explicit `Push` answer, and do not infer consent from earlier context in the conversation.
   - **Push** → run `git push --follow-tags`.
   - **Cancel** (or anything else) → stop here. Leave the local commit/tag as-is (don't undo them unless asked)
     and tell the user how to push later themselves.
8. Point the user to the Actions run / the new GitHub Release (with the `.vsix` asset) once pushed — don't assume
   success without them checking, since this skill can't watch CI itself.

## Notes

- `npm audit --audit-level=high` must report 0 high/critical findings before any push (step 2) — this applies
  even to dev-only/toolchain dependencies (e.g. via `@vscode/test-cli`'s bundled `mocha`), not just runtime ones.
- `package.json` has `"private": true` — this is intentionally not an npm-registry publish, only a GitHub Release
  VSIX build. Don't remove `private` or add npm publish steps.
- Tags must match `v*.*.*` (e.g. `v0.0.2`) — `npm version` already produces this format, don't override the tag
  name.
- If `npm version` fails because the working tree isn't clean, that means step 1, step 2's audit fix, or step 4's
  changelog commit was skipped (or left staged/unstaged) — go back and commit first rather than forcing
  (`--force`) past it. Untracked files count too, not just tracked ones.
- [CHANGELOG.md](../../../CHANGELOG.md) is the source of truth for what shipped in each version — every release
  must add a section to it, don't skip step 4 even for small releases.
