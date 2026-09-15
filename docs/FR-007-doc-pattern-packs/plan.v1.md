# Implementation Plan: FR-007 Documentation Pattern Packs (v1)

**Status**: Approved

> **Descoped mid-implementation**: only the `patterns.ts`/`buildSpecmeshYml`/`scaffoldSdlc` refactor below
> actually shipped, using just the built-in pack. The "which pattern?" prompt, `discoverCustomPacks()`, and the
> README schema doc described in this plan were implemented and then reverted. See spec.v1.md's Revision Note
> and walkthrough.v1.md for what's actually in the codebase. This plan is left as-is (not rewritten) as a
> reference for a future FR that revisits custom pattern packs.

## Affected Files/Projects

- [src/scaffold/patterns.ts](../../src/scaffold/patterns.ts) — **new**. `PatternPack`/`PatternTemplateEntry`
  types, the built-in `spec-driven-dev` pack descriptor, and `discoverCustomPacks()` for
  `.specmesh/patterns/<name>/pattern.yml`.
- [src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts) — replace the hardcoded template/doc-type logic
  with pack-driven logic; add the "which pattern?" prompt.
- `templates/` — unchanged on disk; still owned/read by the built-in pack descriptor exactly as today (no file
  moves), keeping this change low-risk for the one pack that ships today.
- [README.md](../../README.md) — document the `.specmesh/patterns/<name>/pattern.yml` schema, next to the
  existing `.specmesh.yml` section.
- [src/test/patterns.test.ts](../../src/test/patterns.test.ts) — **new**. Pure-function tests for manifest
  parsing/validation and token substitution.

## Approach

### Pack model (`patterns.ts`)

```ts
interface PatternTemplateEntry {
  src: string;                 // path relative to the pack's own folder
  dest: string;                 // path relative to a repo folder (or the root repo, if scope === "root")
  scope: "root" | "perRepo";
  /** if set, this template's rendered dest path (relative to each per-repo folder) is exposed to
   *  later-rendered templates as `{{TOKEN}}` -- generalizes today's MISSION_DOC_REL/SDD_DOC_REL/EPICS_DIR_REL. */
  relToken?: string;
}

interface PatternPack {
  id: string;
  name: string;
  description: string;
  docTypes: DocTypeDefinition[];       // non-root track: entries (today's getBuiltinDefaultDocTypes())
  rootDocTypes: DocTypeDefinition[];   // extra track: entries added only for the root repo
  templates: PatternTemplateEntry[];
  ensureDirs: { path: string; scope: "root" | "perRepo" }[];
  readTemplate(relPath: string): Promise<string>;  // built-in reads from extensionUri/templates, custom reads from its own folder
}
```

- **Built-in pack** (`getBuiltinPack(extensionUri)`): hand-written descriptor in `patterns.ts` whose `docTypes`
  come straight from the existing `getBuiltinDefaultDocTypes()` (single source of truth, unchanged), whose
  `rootDocTypes` are today's mission/sdd/epic entries (moved out of `scaffold.ts`'s `buildSpecmeshYml`
  unchanged), and whose `templates`/`ensureDirs` arrays describe exactly today's file set (mission.md → root,
  spec-driven-development.md → root, copilot-instructions.md/new-feature+change-request SKILL.md → perRepo,
  with `relToken`s `MISSION_DOC_REL`/`SDD_DOC_REL`/`EPICS_DIR_REL` matching today's tokens). `readTemplate`
  delegates to the existing `templates/` folder — no template files move.
- **Custom packs** (`discoverCustomPacks(folders)`): for each workspace folder, look for
  `.specmesh/patterns/*/pattern.yml`, parse with the `yaml` package (same as `.specmesh.yml`), validate
  (`name`, `docTypes` non-empty required; `id` defaults to the folder name; `description`/`rootDocTypes`/
  `templates`/`ensureDirs` default to `""`/`[]`), and skip + `console.warn`/output-channel warning on a
  malformed one rather than throwing. `readTemplate` reads sibling files under that same pack folder via
  `vscode.workspace.fs.readFile`.

### `scaffold.ts` changes

1. After picking folders/root (unchanged), gather all available packs: `[getBuiltinPack(context.extensionUri),
   ...discoverCustomPacks(picked)]`.
2. If more than one pack is available, prompt with `showQuickPick` showing `name` as the label and
   `description` as the detail; auto-select when there's exactly one (today's only case). No pick → abort, same
   as today's other cancellable prompts.
3. Replace `buildSpecmeshYml(isRoot)` with `buildSpecmeshYml(pack, isRoot)`, using `pack.rootDocTypes`/
   `pack.docTypes` instead of the hardcoded root array + `getBuiltinDefaultDocTypes()`.
4. Replace the hand-written sequence of `readTemplate`/`substitute`/`writeIfMissing` calls with a loop over
   `pack.templates`: resolve `dest` against the root repo (scope `root`) or each picked repo (scope `perRepo`),
   substitute tokens (existing `PRODUCT_NAME`/`REPO_LAYOUT` plus any `relToken`s computed from earlier
   root-scope templates), call `pack.readTemplate(entry.src)`, and `writeIfMissing`. Root-scope templates render
   once (before the per-repo loop, as today); per-repo-scope templates render inside the existing per-repo loop.
5. Replace the hardcoded `ensureDir` calls with a loop over `pack.ensureDirs` (same root vs. perRepo split).
6. Everything else (folder/root picking, product name prompt, `writeIfMissing`'s never-overwrite semantics,
   the summary output-channel log) stays as-is.

### Data

No changes to `DocTypeDefinition` (FR-4) or `.specmesh.yml`'s shape/behavior for the built-in pack — this FR
only changes *how* `scaffold.ts` obtains the doc-type list and template files, not the resulting file contents
for today's one pack.

## Sequencing

1. Add `patterns.ts` with the `PatternPack` model and the built-in pack descriptor (pure addition, nothing
   calls it yet).
2. Add `discoverCustomPacks()` + manifest parsing/validation.
3. Refactor `scaffold.ts` to consume `patterns.ts` (pack prompt, pack-driven template loop, pack-driven
   `buildSpecmeshYml`). Manually verify the built-in pack still produces byte-identical output to today's
   `scaffoldSdlc` run on a scratch workspace.
4. Add `patterns.test.ts` (manifest validation, token substitution, `buildSpecmeshYml` with a pack).
5. Document the custom pack schema in README.md.

## Risks / Tradeoffs

- Generalizing `MISSION_DOC_REL`/`SDD_DOC_REL`/`EPICS_DIR_REL` into a generic `relToken` mechanism is slightly
  more abstract than today's three named tokens, but avoids hardcoding pattern-specific token names into
  `scaffold.ts`, which would defeat the point of this FR. Kept to the minimum needed (still just relative-path
  string substitution, same `{{TOKEN}}` mechanics as today).
- No JSON-schema validation for `pattern.yml` (mirrors `.specmesh.yml`, which also has none today) — malformed
  custom packs are caught by the FR-3 required-field checks, not full schema validation.
- Built-in pack's `templates/` files stay where they are (not moved under a `templates/patterns/spec-driven-dev/`
  subfolder) to keep this change low-risk; a future FR adding a second built-in pack can decide then whether to
  relocate them for symmetry with custom packs.
