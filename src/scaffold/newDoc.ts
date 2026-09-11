import * as vscode from "vscode";
import { buildSpecmeshYml } from "./scaffold";
import { loadRepoConfig } from "../crawler/repoConfig";
import { getDocTypeDefinitions } from "../crawler/docTypes";

// FR/mission/SDD stay out of the "Add new..." picker: FR spec/plan/tasks/walkthrough is a multi-file flow
// owned by /new-feature, mission.md is created only by the scaffold command, and the SDD doc is a
// hand-authored singleton, not something to spin up ad hoc.
const NON_ADDABLE_TYPES = new Set(["fr-spec", "fr-plan", "fr-tasks", "fr-walkthrough", "mission", "sdd"]);

function findFolder(folderName: string): vscode.WorkspaceFolder | undefined {
  return (vscode.workspace.workspaceFolders ?? []).find((f) => f.name === folderName);
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/** Opens a folder's existing .specmesh.yml, or creates one (seeded from the same non-root defaults
 * `scaffoldSdlc` writes) and opens that instead. */
export async function openOrCreateConfig(folderName: string): Promise<void> {
  const folder = findFolder(folderName);
  if (!folder) {
    return;
  }
  const uri = vscode.Uri.joinPath(folder.uri, ".specmesh.yml");
  if (!(await fileExists(uri))) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(buildSpecmeshYml(false), "utf8"));
  }
  await vscode.window.showTextDocument(uri);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Longest digit run in a file name, e.g. "ADR-004-foo.md" -> 4. */
function extractNumber(fileName: string): number | undefined {
  const matches = fileName.match(/\d+/g);
  return matches ? Math.max(...matches.map((m) => parseInt(m, 10))) : undefined;
}

async function nextNumber(folder: vscode.WorkspaceFolder, glob: string): Promise<number> {
  const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, glob));
  const numbers = files
    .map((f) => extractNumber(f.path.split("/").pop() ?? ""))
    .filter((n): n is number => n !== undefined);
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}

/** A glob's wildcard immediately preceded by "-" (e.g. "ADR-*.md", "EPIC-*.md") is specmesh's numbered-doc
 * convention, vs a freeform wildcard like "docs/reference/*.md" or ".github/skills/*\/SKILL.md". */
function isNumberedGlob(glob: string): boolean {
  return /-\*/.test(glob);
}

// Substitutes every "*" in a glob with a literal segment -- a plain (not regex) replace would only catch
// the first wildcard, leaving a literal "*" in a doubly-wildcarded glob (e.g. an "fr-spec"-style glob).
function globToPath(glob: string, replacement: string): string {
  return glob.replace(/\*/g, replacement);
}

/** Quick-picks one of a folder's tracked single-file doc types (excluding FR spec/plan/tasks/walkthrough,
 * which stay owned by /new-feature), prompts for a title, derives a numbered/slug file path, and writes a
 * minimal template file. */
export async function addNewDoc(folderName: string): Promise<void> {
  const folder = findFolder(folderName);
  if (!folder) {
    return;
  }

  const repoConfig = await loadRepoConfig(folder);
  const defs = (repoConfig.track ?? getDocTypeDefinitions()).filter((d) => !NON_ADDABLE_TYPES.has(d.type));
  if (defs.length === 0) {
    vscode.window.showWarningMessage(`specmesh: ${folderName} has no addable doc types tracked.`);
    return;
  }

  const picked = await vscode.window.showQuickPick(
    defs.map((d) => ({ label: d.label, def: d })),
    { placeHolder: "Which kind of doc?" }
  );
  if (!picked) {
    return;
  }

  const title = await vscode.window.showInputBox({ prompt: "Title" });
  if (!title) {
    return;
  }

  const glob = picked.def.glob;
  let defaultRelPath: string;
  if (glob.includes("*")) {
    const slug = slugify(title);
    const replacement = isNumberedGlob(glob)
      ? `${String(await nextNumber(folder, glob)).padStart(3, "0")}-${slug}`
      : slug;
    defaultRelPath = globToPath(glob, replacement);
  } else {
    defaultRelPath = glob;
  }

  const relPath = await vscode.window.showInputBox({
    prompt: "Confirm file path",
    value: defaultRelPath,
  });
  if (!relPath) {
    return;
  }

  const uri = vscode.Uri.joinPath(folder.uri, relPath);
  if (await fileExists(uri)) {
    vscode.window.showWarningMessage(`specmesh: ${relPath} already exists.`);
    return;
  }

  await vscode.workspace.fs.writeFile(uri, Buffer.from(`# ${title}\n\n**Status**: Draft\n`, "utf8"));
  await vscode.window.showTextDocument(uri);
}
