import * as vscode from "vscode";
import { DocTypeDefinition } from "../model/types";
import { getBuiltinDefaultDocTypes } from "../crawler/docTypes";

export interface PatternTemplateEntry {
  /** path relative to the pack's own folder (built-in: `templates/`; custom: the pack's own folder) */
  src: string;
  /** path relative to a repo folder (or the root repo, when `scope` is `"root"`) */
  dest: string;
  scope: "root" | "perRepo";
  /** if set, this template's rendered dest path (relative to each per-repo folder) is exposed to
   *  later-rendered templates as `{{<relToken>}}`. */
  relToken?: string;
}

export interface PatternEnsureDirEntry {
  /** path relative to a repo folder (or the root repo, when `scope` is `"root"`) */
  path: string;
  scope: "root" | "perRepo";
  relToken?: string;
}

/** `{docTypes, scaffold templates, skill(s)}` for one documentation pattern -- see docs/roadmap.md "Vector 2". */
export interface PatternPack {
  id: string;
  name: string;
  description: string;
  /** `track:` entries for every scaffolded repo, including the root */
  docTypes: DocTypeDefinition[];
  /** extra `track:` entries added only for the root repo's `.specmesh.yml` */
  rootDocTypes: DocTypeDefinition[];
  templates: PatternTemplateEntry[];
  ensureDirs: PatternEnsureDirEntry[];
  readTemplate(relPath: string): Promise<string>;
}

/** The `spec-driven-dev` pack's data, independent of how its template files are actually read -- pure/testable. */
export const BUILTIN_PACK_DATA: Omit<PatternPack, "readTemplate"> = {
  id: "spec-driven-dev",
  name: "Specmesh Default",
  description:
    "Charter -> epic -> FR/ADR/reference spec-driven development, with Copilot skills for drafting and " +
    "implementing features.",
  docTypes: getBuiltinDefaultDocTypes(),
  rootDocTypes: [
    { type: "charter", label: "Charter", glob: "docs/charter.md", root: true },
    { type: "sdd", label: "Spec-Driven Development", glob: "docs/spec-driven-development.md", root: true },
    { type: "epic", label: "Epics", glob: "docs/epics/EPIC-*.md", root: true },
  ],
  templates: [
    { src: "charter.md", dest: "docs/charter.md", scope: "root", relToken: "CHARTER_DOC_REL" },
    {
      src: "spec-driven-development.md",
      dest: "docs/spec-driven-development.md",
      scope: "root",
      relToken: "SDD_DOC_REL",
    },
    { src: "copilot-instructions.md", dest: ".github/copilot-instructions.md", scope: "perRepo" },
    { src: "skills/new-feature/SKILL.md", dest: ".github/skills/new-feature/SKILL.md", scope: "perRepo" },
    {
      src: "skills/new-feature/references/epic-template.md",
      dest: ".github/skills/new-feature/references/epic-template.md",
      scope: "perRepo",
    },
    { src: "skills/change-request/SKILL.md", dest: ".github/skills/change-request/SKILL.md", scope: "perRepo" },
  ],
  ensureDirs: [
    { path: "docs/epics", scope: "root", relToken: "EPICS_DIR_REL" },
    { path: "docs/adr", scope: "perRepo" },
    { path: "docs/reference", scope: "perRepo" },
    { path: ".github/instructions", scope: "perRepo" },
  ],
};

export function getBuiltinPack(extensionUri: vscode.Uri): PatternPack {
  return {
    ...BUILTIN_PACK_DATA,
    readTemplate: (relPath) => readPackFile(vscode.Uri.joinPath(extensionUri, "templates"), relPath),
  };
}

async function readPackFile(dirUri: vscode.Uri, relPath: string): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(dirUri, relPath));
  return Buffer.from(bytes).toString("utf8");
}

