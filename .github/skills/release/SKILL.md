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
2. Ask the user for the semver bump if not given: `patch` (default, bug fixes/small doc changes), `minor` (new
   user-facing capability, backward compatible), or `major` (breaking change). Infer a reasonable default from the
   diff being released, but confirm rather than guessing on anything that looks bigger than a patch.
3. Run `npm version <patch|minor|major> -m "chore: release v%s"` from the repo root. This bumps the `version`
   field in [package.json](../../../package.json), commits that one-line change, and creates an annotated git tag
   `vX.Y.Z` pointing at it — do not hand-edit `package.json`'s version or create the tag manually.
4. Push the commit and the tag together: `git push --follow-tags` (plain `git push` alone will NOT push the tag).
5. **Gate — mandatory, ask before this step.** Use the ask-questions tool: header "Push Release", question
   "Push commit + tag v<X.Y.Z> to origin now? This triggers a public GitHub Actions release build.", options
   `Push` / `Cancel` (allow freeform input for anything else, e.g. "wait" or a different tag). Do not push without
   an explicit `Push` answer, and do not infer consent from earlier context in the conversation.
   - **Push** → run `git push --follow-tags`.
   - **Cancel** (or anything else) → stop here. Leave the local commit/tag as-is (don't undo them unless asked)
     and tell the user how to push later themselves.
6. Point the user to the Actions run / the new GitHub Release (with the `.vsix` asset) once pushed — don't assume
   success without them checking, since this skill can't watch CI itself.

## Notes

- `package.json` has `"private": true` — this is intentionally not an npm-registry publish, only a GitHub Release
  VSIX build. Don't remove `private` or add npm publish steps.
- Tags must match `v*.*.*` (e.g. `v0.0.2`) — `npm version` already produces this format, don't override the tag
  name.
- If `npm version` fails because the working tree isn't clean, that means step 1 was skipped — go back and commit
  first rather than forcing (`--force`) past it.
