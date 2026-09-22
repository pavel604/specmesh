# specmesh

Cross-repo documentation graph for the agentic spec-driven development lifecycle, in multi-root VS Code
workspaces.

When charter → epic → FR (spec/plan/tasks/walkthrough) docs and their instructions/skills are spread
across several repos — the norm once AI coding agents are driving that lifecycle instead of one person
holding it all in their head — git tracks each repo's own history but has no notion of a doc in one
repo linking to a doc in another, whether a skill's prerequisites are still met, or whether a doc an
agent depends on quietly disappeared. specmesh sits on top of those independent git repos and adds the
thing that's missing:

- **Docs Explorer** (activity bar) — every open workspace folder's charter/epic/ADR/FR
  spec+plan+tasks+walkthrough/reference/instructions/skill docs, browsable in one tree, without
  needing to know each repo's folder layout.
- **Broken cross-repo link detection** — relative markdown links (e.g. one pointing to
  `../../../other-repo/docs/FR-002/spec.v1.md`), as well as links prefixed with `${workspaceFolder}/`
  (resolved against the linking doc's own workspace folder root), are resolved against the actual filesystem
  and reported as VS Code diagnostics (Problems panel) if the target doesn't exist.
- **Orphan detection** — ADRs/reference docs/FR specs not linked from anywhere else in the graph
  (command: `specmesh: Show Orphaned Docs`).
- **Missing tracked file detection** — a literal (wildcard-free) `track` entry (e.g. a specific
  `docs/charter.md`) that no longer resolves to a file is flagged as a red "missing" entry in the tree
  (command: `specmesh: Show Missing Tracked Files`).
- **Git decorations reused, not reinvented** — doc entries are wired to their real file's `resourceUri`,
  so VS Code's own git color/badge (modified, added, etc.) shows up on them for free, same as Explorer.
- **Scaffold the SDLC structure itself** — `specmesh: Scaffold Spec-Driven Development Structure` (also
  offered as a button right in the Docs view when nothing's tracked yet) sets up `docs/charter.md`,
  `docs/spec-driven-development.md`, `docs/epics/`, per-repo `docs/adr/`, `docs/reference/`,
  `.github/instructions/`, `.github/copilot-instructions.md`, the `new-feature`/`change-request` skills,
  and a `.specmesh.yml` per repo so it all shows up in the tree immediately — generic and safe to run
  against any workspace (never overwrites a file that already exists).
- **Copilot Chat tools** — 7 Language Model Tools (see "Copilot Chat tools" below) so agent mode can
  query and extend the doc graph itself instead of you running specmesh commands manually.

## Quick start

1. Install the extension, then open the folder or multi-root workspace containing the repo(s) you want to
   track.
2. Click the specmesh icon in the activity bar to open the **Docs** view — it crawls automatically on
   activation (you'll see a "Loading docs…" spinner while it does). Out of the box it picks up each repo's
   `docs/adr/`, `docs/reference/`, `docs/FR-*/`, `.github/instructions/`, and `.github/skills/` (see "Doc
   types it looks for" below).
3. Nothing tracked yet? The Docs view itself offers a **Scaffold Spec-Driven Development Structure** button
   right there — no need to hunt through the Command Palette. It asks a couple of questions and writes
   `docs/charter.md`, `docs/spec-driven-development.md`, `docs/epics/`, per-repo `docs/adr/`,
   `docs/reference/`, `.github/instructions/`, `.github/copilot-instructions.md`, the `new-feature`/
   `change-request` skills, and a `.specmesh.yml` per repo (so everything it just created shows up in the
   tree immediately, charter/epic included) — never overwriting anything that already exists.
4. Already have docs but in a different shape, or want to track/exclude something specific? Edit that
   repo's `.specmesh.yml` (auto-created by step 3, or add your own) — see "Per-repo config" below. Changes
   are picked up automatically, no reload needed. Every repo's node in the tree also has its own pinned
   `.specmesh.yml` entry — click it to open the file (or create one, seeded with specmesh's defaults, if it
   doesn't exist yet).
5. Want to start a new tracked doc (ADR, reference, etc.) without leaving the tree? Use the **Add new…**
   inline button on a repo's node — it quick-picks a doc type, asks for a title, and writes the file at the
   right path (deriving the next number for numbered types like ADRs). Right-click any doc entry for a
   **Delete Doc** action (moves it to the OS trash, with a confirmation first).
6. Other useful commands: **specmesh: Refresh Docs Index**, **specmesh: Show Orphaned Docs**,
   **specmesh: Show Missing Tracked Files**.
7. Fill out `docs/charter.md` in the root repo (Problem / Approach / Who this is for / Non-goals), then
   start building features from Copilot Chat with the scaffolded `new-feature`/`change-request` skills
   (e.g. `/new-feature <user story>`).


## Doc types it looks for (configurable via `specmesh.docTypes`)

By default: `docs/adr/ADR-*.md`, `docs/reference/*.md`, `docs/FR-*/{spec,plan,tasks,walkthrough}.v*.md`,
`.github/instructions/*.instructions.md`, `.github/skills/*/SKILL.md` — all anchored to the repo root (no
leading `**/`) for crawl speed and so nested scaffolding-kit copies of these files aren't picked up by
accident. Override or extend the list via the `specmesh.docTypes` setting if your convention differs
globally, or per-repo via `.specmesh.yml` below.

`charter`/`epic` are deliberately **not** in this default list — one charter/epic set belongs to a whole
product, not to every repo, so it's opt-in per repo via `track:` in that repo's `.specmesh.yml` (see the
root repo's example below), never a global fallback. Otherwise every repo without its own `docs/charter.md`
would show a false "missing" entry.

## Tree appearance

- Doc label/secondary text is controlled by `specmesh.docLabelFormat`: `title` (label only, no
  secondary text), `filename` (filename as label, title as secondary text), or `both` (title as label,
  filename as secondary text — the default).
- A doc with one or more broken outgoing links gets a yellow warning icon.
- A `track` entry that doesn't resolve to any file shows as a red "missing" leaf under its category.
- Every repo's node has a pinned `.specmesh.yml` entry (before its doc-type categories) — click to open it,
  or to create one if it doesn't exist yet — and an inline **Add new…** button to scaffold a new tracked doc.
- Git's own modified/added decorations apply automatically (see above) — nothing specmesh-specific to
  configure for that.
- A search icon in the view's title bar opens a live filter box — typing narrows the tree to only docs whose
  title or filename contains that text (matching as you type, no need to press Enter); the status row is
  prefixed with the active filter so it's clear the tree is narrowed rather than empty. A "clear filter" icon
  appears next to it while a filter is active.

## Per-repo config: `.specmesh.yml`

Drop a `.specmesh.yml` at the root of any tracked repo/workspace folder to control exactly what
specmesh tracks there, without affecting anyone else's repo. It's a normal file you commit to that
repo, same as `.gitignore`. Your documentation structure doesn't have to match specmesh's defaults or
even another repo's — add, rename, or remove `track:` entries (or their `glob`s) to match whatever
folder/file layout that repo actually uses; no code changes or reload needed, specmesh just re-crawls.

```yaml
track: # replaces the doc types for THIS repo only (a whitelist, not a blacklist)
  - type: charter
    label: Charter
    glob: "docs/charter.md" # no wildcards -> flagged as "missing" if this file disappears
  - type: epic
    label: Epics
    glob: "docs/epics/EPIC-*.md" # has a wildcard -> just enumerated, not missing-checked
  - type: github
    label: GitHub
    glob: ".github/**/*.md"      # broad catch-all
    exclude:                     # optional: glob(s) to exclude from this entry's matches
      - ".github/skills/*/templates/**"
  - type: fr-spec
    label: FR Specs
    glob: "docs/FR-*/spec.v*.md"
    children:                    # optional: nest matched instances of these types in the tree
      - type: fr-plan
        label: FR Plans
        glob: "docs/FR-*/plan.v*.md"
```

`children` nests a matched instance of that type under the specific parent instance sharing its directory
and version number (e.g. `plan.v2.md` nests under `spec.v2.md` in the same `docs/FR-*/` folder) instead of
listing it under its own top-level category. An instance with no version-matching parent (or no `children`
declared at all) still renders under its own top-level category, exactly like today.

`track` is a whitelist: list exactly the doc types/globs this repo has, in the shape it actually uses
them. Repos without a `.specmesh.yml` fall back to the global `specmesh.docTypes` default. This is
also what makes crawling fast — specmesh only ever looks in the specific paths declared, never walks
an entire repo tree.

## Copilot Chat tools

specmesh registers itself as Language Model Tools, so Copilot's agent mode can answer doc-graph
questions (or fix them) on its own — no need to open the Docs view or run a command yourself. They also
work as manual `#`-mentions in chat.

| Tool | Use it to |
|---|---|
| `#specmeshDocs` | Find a tracked doc by folder, type, or title/path text |
| `#specmeshBrokenLinks` | Check for dead cross-repo/relative links before trusting a doc |
| `#specmeshOrphans` | Find ADRs/reference docs/FR specs nothing else links to |
| `#specmeshMissing` | Check a literal tracked file (e.g. `docs/charter.md`) still exists |
| `#specmeshDocLinks` | See what one specific doc links out to, and whether each resolves |
| `#specmeshUpdateConfig` | Add/update a repo's `.specmesh.yml` track entry (asks for confirmation first) |
| `#specmeshHelp` | Ground the agent in specmesh's own README before it answers "how does X work" |

Agent mode will also call these on its own when relevant — e.g. asking Copilot "are there any broken
links in this workspace" or "start tracking `docs/runbooks/*.md` in this repo" needs no `#`-mention at
all.

## Change tracking / diffs — design notes (not yet built)

specmesh deliberately doesn't reinvent git for this:

- Every tracked doc is a real file in a real git repo already. Wiring `resourceUri` (done) means VS
  Code's built-in git decorations, "Open Changes", and "Open Timeline" already work on these files with
  zero extra code — that's the "highlight changed files" ask, for free.
- For an aggregated cross-repo history (e.g. "what did the whole doc graph look like on date X"), the
  right building block is the [VS Code Git extension's API](https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts)
  (`vscode.extensions.getExtension('vscode.git').exports.getAPI(1)`) — it exposes each open repo's
  `log()`/`diffWithHEAD()` without specmesh needing to shell out to `git` itself.
- "Collect these files into a repo" is really two different asks worth keeping separate: (1) snapshot
  the generated graph/index itself (a JSON manifest) and commit _that_ somewhere versioned — this is
  the earlier-deferred "cloud" phase, just using a git repo as the transport instead of a hosted
  service; (2) track diffs of the underlying docs — already solved by each doc's own repo, no new
  storage needed. Recommend building (1) only if a real need shows up for viewing history without every
  repo cloned locally; don't build a parallel diff engine for (2).

## Running it

1. `npm install`
2. Press F5 (or run the `watch` task + Run Extension launch config) to open an Extension Development
   Host with this repo's own multi-root workspace loaded.

## Scaffolding a new product's SDLC structure

`specmesh: Scaffold Spec-Driven Development Structure` (Command Palette) walks through:

1. Which open workspace folder(s) make up this product (skipped if only one is open).
2. Which of those is the charter/epic root (the repo `docs/charter.md`, `docs/spec-driven-development.md`, and
   `docs/epics/` live in).
3. The product name.

It then writes, per repo, whatever doesn't already exist: `docs/adr/`, `docs/reference/`, `.github/instructions/`,
`.github/copilot-instructions.md` (pointer-only, linking back to the root's charter/SDD docs by relative path),
and the `new-feature`/`change-request` skills under `.github/skills/`; plus, root-only, `docs/charter.md`,
`docs/spec-driven-development.md`, and `docs/epics/`. Templates live in `templates/` in this repo and are
genericized/token-substituted (`{{PRODUCT_NAME}}`, `{{REPO_LAYOUT}}`, `{{CHARTER_DOC_REL}}`, `{{SDD_DOC_REL}}`,
`{{EPICS_DIR_REL}}`) — nothing product-specific. It never overwrites an existing file; re-running it after
editing the generated docs is safe.

## Status

MVP / local-only. No cloud/hosted index yet — that's a deliberately deferred later phase.
