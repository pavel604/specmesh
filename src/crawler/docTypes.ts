import * as vscode from "vscode";
import { DocTypeDefinition } from "../model/types";

// Matches a generic mission -> epic -> FR -> ADR/reference convention (see docs/spec-driven-development.md
// in a repo that has scaffolded one). Anchored to the repo root (no leading "**/") both for crawl speed and
// so nested scaffolding-kit copies of these files aren't picked up by accident.
// mission/epic are deliberately NOT here: they're a root-only concept (one per product, not one per repo) —
// a repo only tracks them via its own .specmesh.yml `track:` list, otherwise every repo without a mission.md
// of its own would get a false "missing" flag.
const DEFAULT_DOC_TYPES: DocTypeDefinition[] = [
  { type: "adr", label: "ADRs", glob: "docs/adr/ADR-*.md" },
  { type: "reference", label: "Reference", glob: "docs/reference/*.md" },
  { type: "fr-spec", label: "FR Specs", glob: "docs/FR-*/spec.v*.md" },
  { type: "fr-plan", label: "FR Plans", glob: "docs/FR-*/plan.v*.md", root: true },
  { type: "fr-tasks", label: "FR Tasks", glob: "docs/FR-*/tasks.v*.md", root: true },
  { type: "fr-walkthrough", label: "FR Walkthroughs", glob: "docs/FR-*/walkthrough.v*.md", root: true },
  { type: "instructions", label: "Instructions", glob: ".github/instructions/*.instructions.md", root: true },
  { type: "skill", label: "Skills", glob: ".github/skills/*/SKILL.md", root: true },
];

export function getDocTypeDefinitions(): DocTypeDefinition[] {
  const configured = vscode.workspace
    .getConfiguration("specmesh")
    .get<DocTypeDefinition[]>("docTypes");
  return configured && configured.length > 0 ? configured : DEFAULT_DOC_TYPES;
}

/** A fresh copy of specmesh's intrinsic defaults, independent of any user/workspace `specmesh.docTypes`
 * override -- used when generating a repo's own `.specmesh.yml` so it's a portable, self-contained file. */
export function getBuiltinDefaultDocTypes(): DocTypeDefinition[] {
  return DEFAULT_DOC_TYPES.map((d) => ({ ...d }));
}
