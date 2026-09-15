# Tasks: FR-007 Documentation Pattern Packs (v1)

> **Descoped mid-implementation** (see spec.v1.md's Revision Note): T2, T3 (pattern picker), T10-T13
> (`createPatternPack` command + custom-pack auto-track) were implemented, then reverted, because a
> user-facing custom-pack-authoring surface needed more design than fit in this FR. What remains is the
> internal `PatternPack` refactor of `scaffold.ts` (T1, T4, T5) driving only the one built-in pack.

- [x] T1 — Add `src/scaffold/patterns.ts` with `PatternTemplateEntry`/`PatternPack` types and
      `getBuiltinPack(extensionUri)` returning the `spec-driven-dev` descriptor (id/name/description,
      `docTypes` from `getBuiltinDefaultDocTypes()`, `rootDocTypes` = today's mission/sdd/epic entries,
      `templates`/`ensureDirs` matching today's file set with `relToken`s `MISSION_DOC_REL`/`SDD_DOC_REL`/
      `EPICS_DIR_REL`, `readTemplate` delegating to the existing `templates/` folder).
- [x] T2 — ~~Add `discoverCustomPacks(folders)` to `patterns.ts`...~~ **Reverted** — see Revision Note.
- [x] T3 — ~~Refactor `scaffold.ts`: gather `[getBuiltinPack(...), ...discoverCustomPacks(picked)]`, add a
      `pickPattern()` prompt...~~ **Reverted** — `scaffoldSdlc` always uses `getBuiltinPack()` directly, no
      picker (there's only ever one pack). See Revision Note.
- [x] T4 — Replace `buildSpecmeshYml(isRoot)` with `buildSpecmeshYml(pack, isRoot)` driven by
      `pack.rootDocTypes`/`pack.docTypes`.
- [x] T5 — Replace the hardcoded template-write sequence and `ensureDir` calls in `scaffoldSdlc` with loops over
      `pack.templates` (root-scope first, then per-repo scope inside the existing per-repo loop, substituting
      `relToken`s) and `pack.ensureDirs`.
- [ ] T6 — Manually run `specmesh: Scaffold Spec-Driven Development Structure` against a scratch multi-root
      workspace and diff the output against a pre-refactor run to confirm the built-in pack still produces
      byte-identical files.
- [x] T7 — Add `src/test/patterns.test.ts` covering: built-in pack manifest shape and `buildSpecmeshYml` with a
      pack (custom-pack-manifest-parsing tests removed along with T2/T3's revert).
- [x] T8 — ~~Document the `.specmesh/patterns/<name>/pattern.yml` schema in README.md...~~ **Reverted** — see
      Revision Note; README's scaffold-command walkthrough no longer mentions a pattern-selection step.
- [x] T9 — Update `docs/epics/EPIC-002-custom-documentation-patterns.md`'s Stories table with FR-007.
- [x] T10 — ~~Add a `specmesh.createPatternPack` command...~~ **Reverted** — see Revision Note.
- [x] T11 — ~~Surface `specmesh.createPatternPack` in the Docs Explorer...~~ **Reverted** — see Revision Note.
- [x] T12 — ~~After `createPatternPack` writes the manifest, show an info message...~~ **Reverted** — see
      Revision Note.
- [x] T13 — ~~Replace T12's button with an immediate, automatic scaffold...~~ **Reverted** — see Revision Note.
      All of `createPatternPack.ts`, `upsertTrackEntries()`, `STARTER_DOC_TYPE`, and the command's
      `package.json`/`extension.ts` wiring were removed.
