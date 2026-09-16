import * as vscode from "vscode";
import * as path from "path";
import { crawlWorkspace } from "../crawler/crawler";
import { DocNode } from "../model/types";
import { execGit } from "./gitPlumbing";
import { findSpecGitRoot, isUnderPath, setRepoUntracked } from "./specRepo";

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** Lines from `linesToAdd` not already present (trimmed, exact match) in `existingContent`. Pure/testable. */
export function computeGitignoreAdditions(existingContent: string, linesToAdd: string[]): string[] {
  const existingLines = new Set(
    existingContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
  );
  return linesToAdd.filter((l) => !existingLines.has(l));
}

/** `existingContent` with any line matching (trimmed, exact match) an entry in `linesToRemove` dropped. Pure/testable. */
export function computeGitignoreRemovals(existingContent: string, linesToRemove: string[]): string {
  const removeSet = new Set(linesToRemove);
  return existingContent
    .split(/\r?\n/)
    .filter((l) => !removeSet.has(l.trim()))
    .join("\n");
}

async function readGitignore(repoAbsolutePath: string): Promise<string> {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(repoAbsolutePath, ".gitignore")));
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return "";
  }
}

async function writeGitignore(repoAbsolutePath: string, content: string): Promise<void> {
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(path.join(repoAbsolutePath, ".gitignore")),
    Buffer.from(content, "utf8")
  );
}

interface RepoTarget {
  label: string;
  absolutePath: string;
}

/** Every repo eligible for Migrate/Untrack: the central-tracking root, plus its `repos:`-declared, present
 * children. Central tracking (and therefore migration) only ever spans this set -- see FR-009's Assumptions. */
async function listRepoTargets(root: vscode.WorkspaceFolder): Promise<RepoTarget[]> {
  const { repos } = await crawlWorkspace();
  const children = repos
    .filter((r) => r.workspaceFolderName === root.name && r.present)
    .map((r) => ({ label: r.name, absolutePath: path.join(root.uri.fsPath, r.path) }));
  return [{ label: `${root.name} (root)`, absolutePath: root.uri.fsPath }, ...children];
}

/** Prompts the user to pick one repo (root or a declared child) to Migrate or Untrack. */
export async function pickRepoTarget(): Promise<RepoTarget | undefined> {
  const root = findSpecGitRoot();
  if (!root) {
    vscode.window.showWarningMessage(
      'specmesh: enable central doc tracking first ("specmesh: Enable Cross-Repo Doc Tracking").'
    );
    return undefined;
  }
  const targets = await listRepoTargets(root);
  const pick = await vscode.window.showQuickPick(
    targets.map((t) => ({ label: t.label, target: t })),
    { placeHolder: "Which repo?" }
  );
  return pick?.target;
}

/** For every doc node, the longest (most specific) repo path among `repoAbsolutePaths` that contains it -- so a
 * file physically inside a child repo is attributed to that child, not to the root, when both contain it. */
function owningRepo(nodeAbsolutePath: string, repoAbsolutePaths: string[]): string {
  let best = "";
  for (const candidate of repoAbsolutePaths) {
    if (isUnderPath(candidate, nodeAbsolutePath) && candidate.length > best.length) {
      best = candidate;
    }
  }
  return best;
}

async function docFilesUnder(
  repoAbsolutePath: string
): Promise<{ nodes: DocNode[]; allRepoAbsolutePaths: string[] }> {
  const root = findSpecGitRoot();
  if (!root) {
    return { nodes: [], allRepoAbsolutePaths: [] };
  }
  const { nodes, repos } = await crawlWorkspace();
  const allRepoAbsolutePaths = [
    root.uri.fsPath,
    ...repos.filter((r) => r.workspaceFolderName === root.name && r.present).map((r) => path.join(root.uri.fsPath, r.path)),
  ];
  const matching = nodes.filter((n) => owningRepo(n.absolutePath, allRepoAbsolutePaths) === repoAbsolutePath);
  return { nodes: matching, allRepoAbsolutePaths };
}

/** Stops `repoAbsolutePath`'s own git from tracking its doc files (`git rm --cached`, keeping the working-tree
 * copy) and adds them to that repo's `.gitignore`, so only `.specmesh/spec.git` tracks their history going
 * forward. Requires confirmation; idempotent (already-untracked files and already-listed `.gitignore` lines are
 * skipped rather than erroring). */
export async function migrateRepoToCentral(
  repoAbsolutePath: string,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    `Migrate doc tracking for "${repoAbsolutePath}" to the central repo? This repo's own git will stop tracking these files (the files on disk are unaffected).`,
    { modal: true },
    "Migrate"
  );
  if (confirm !== "Migrate") {
    return;
  }

  const { nodes } = await docFilesUnder(repoAbsolutePath);
  if (nodes.length === 0) {
    outputChannel.appendLine(`specmesh: no tracked docs found under "${repoAbsolutePath}" to migrate.`);
    outputChannel.show();
    return;
  }

  const migrated: string[] = [];
  for (const node of nodes) {
    const relativeToRepo = toPosix(path.relative(repoAbsolutePath, node.absolutePath));
    try {
      await execGit(["-C", repoAbsolutePath, "rm", "--cached", "-f", "--", relativeToRepo]);
    } catch {
      // not tracked by this repo's own git (e.g. never committed) -- already achieves the goal, continue.
    }
    migrated.push(relativeToRepo);
  }

  const existing = await readGitignore(repoAbsolutePath);
  const additions = computeGitignoreAdditions(existing, migrated);
  if (additions.length > 0) {
    const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
    await writeGitignore(repoAbsolutePath, existing + prefix + additions.join("\n") + "\n");
  }

  outputChannel.appendLine(`specmesh: migrated ${migrated.length} doc(s) under "${repoAbsolutePath}" to central tracking.`);
  outputChannel.show();
}

/** The inverse of `migrateRepoToCentral`: restores `repoAbsolutePath`'s own git tracking of its doc files,
 * removes the `.gitignore` lines migration added, and marks the repo so the live sync scheduler stops sending
 * its doc changes to `.specmesh/spec.git` going forward. Does not rewrite or delete any existing central-repo
 * history. Requires confirmation; idempotent. */
export async function untrackRepoFromCentral(
  repoAbsolutePath: string,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    `Untrack "${repoAbsolutePath}" from central doc tracking? Its own git will resume tracking these files.`,
    { modal: true },
    "Untrack"
  );
  if (confirm !== "Untrack") {
    return;
  }

  const { nodes } = await docFilesUnder(repoAbsolutePath);
  const relativePaths = nodes.map((n) => toPosix(path.relative(repoAbsolutePath, n.absolutePath)));

  if (relativePaths.length > 0) {
    const existing = await readGitignore(repoAbsolutePath);
    await writeGitignore(repoAbsolutePath, computeGitignoreRemovals(existing, relativePaths));
    try {
      await execGit(["-C", repoAbsolutePath, "add", "--", ...relativePaths]);
    } catch (err) {
      outputChannel.appendLine(`specmesh: could not re-add all files to "${repoAbsolutePath}"'s own git: ${(err as Error).message}`);
    }
  }

  await setRepoUntracked(context, repoAbsolutePath, true);

  outputChannel.appendLine(`specmesh: untracked ${relativePaths.length} doc(s) under "${repoAbsolutePath}" from central tracking.`);
  outputChannel.show();
}
