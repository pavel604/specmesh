import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execGit, isGitAvailable } from "./gitPlumbing";

const SPEC_GIT_RELATIVE_PATH = path.join(".specmesh", "spec.git");
const UNTRACKED_REPOS_KEY = "specmesh.untrackedRepos";

/** Whether `child` is `parent` itself or nested under it. */
export function isUnderPath(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** The workspace folder that owns `.specmesh/spec.git`, if central tracking has been enabled anywhere in this
 * workspace. Disk existence is the sole source of truth -- no separate persisted setting is needed. */
export function findSpecGitRoot(): vscode.WorkspaceFolder | undefined {
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (fs.existsSync(path.join(folder.uri.fsPath, SPEC_GIT_RELATIVE_PATH))) {
      return folder;
    }
  }
  return undefined;
}

export function gitDirFor(root: vscode.WorkspaceFolder): string {
  return path.join(root.uri.fsPath, SPEC_GIT_RELATIVE_PATH);
}

async function pickRootFolder(
  folders: readonly vscode.WorkspaceFolder[]
): Promise<vscode.WorkspaceFolder | undefined> {
  if (folders.length === 1) {
    return folders[0];
  }
  const pick = await vscode.window.showQuickPick(
    folders.map((f) => ({ label: f.name, folder: f })),
    { placeHolder: "Which repo should hold the central .specmesh/spec.git?" }
  );
  return pick?.folder;
}

async function ensureGitignoreEntry(rootPath: string, line: string): Promise<void> {
  const uri = vscode.Uri.file(path.join(rootPath, ".gitignore"));
  let content = "";
  try {
    content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
  } catch {
    // no .gitignore yet
  }
  const lines = content.split(/\r?\n/);
  if (lines.some((l) => l.trim() === line)) {
    return;
  }
  const prefix = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content + prefix + line + "\n", "utf8"));
}

/**
 * Enables cross-repo central doc tracking: initializes a bare git repo at `<root>/.specmesh/spec.git` (with
 * `root` as its work-tree) and ensures the root repo's own `.gitignore` excludes `.specmesh/`. No-ops if
 * already enabled. Returns the root folder on success, `undefined` if the user cancelled or `git` is
 * unavailable.
 */
export async function enableCentralTracking(
  outputChannel: vscode.OutputChannel,
  presetRoot?: vscode.WorkspaceFolder
): Promise<vscode.WorkspaceFolder | undefined> {
  const existingRoot = findSpecGitRoot();
  if (existingRoot) {
    vscode.window.showInformationMessage(
      `specmesh: central doc tracking is already enabled at "${existingRoot.name}".`
    );
    return existingRoot;
  }

  const allFolders = vscode.workspace.workspaceFolders ?? [];
  if (allFolders.length === 0) {
    vscode.window.showWarningMessage("specmesh: open a workspace folder first.");
    return undefined;
  }

  const root = presetRoot ?? (await pickRootFolder(allFolders));
  if (!root) {
    return undefined;
  }

  if (!(await isGitAvailable())) {
    outputChannel.appendLine("specmesh: git executable not found on PATH; central doc tracking was not enabled.");
    vscode.window.showWarningMessage(
      "specmesh: git executable not found on PATH. Central doc tracking was not enabled."
    );
    return undefined;
  }

  const gitDir = gitDirFor(root);
  if (fs.existsSync(gitDir)) {
    try {
      await execGit(["--git-dir", gitDir, "rev-parse", "--git-dir"]);
      outputChannel.appendLine(`specmesh: central doc tracking already initialized at "${gitDir}".`);
      return root;
    } catch {
      const reinit = await vscode.window.showWarningMessage(
        `"${SPEC_GIT_RELATIVE_PATH}" exists but isn't a valid git repo. Reinitialize it? This discards anything in it.`,
        { modal: true },
        "Reinitialize"
      );
      if (reinit !== "Reinitialize") {
        return undefined;
      }
      await fs.promises.rm(gitDir, { recursive: true, force: true });
    }
  }

  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root.uri.fsPath, ".specmesh")));
  await execGit(["init", "--bare", gitDir]);
  await ensureGitignoreEntry(root.uri.fsPath, ".specmesh/");

  outputChannel.appendLine(`specmesh: central doc tracking enabled at "${gitDir}".`);
  return root;
}

/** Records or clears whether `repoAbsolutePath` is opted out of central sync (see `untrackRepoFromCentral`). */
export async function setRepoUntracked(
  context: vscode.ExtensionContext,
  repoAbsolutePath: string,
  untracked: boolean
): Promise<void> {
  const current = context.workspaceState.get<string[]>(UNTRACKED_REPOS_KEY, []);
  const next = untracked
    ? current.includes(repoAbsolutePath)
      ? current
      : [...current, repoAbsolutePath]
    : current.filter((p) => p !== repoAbsolutePath);
  await context.workspaceState.update(UNTRACKED_REPOS_KEY, next);
}

export function isPathUntracked(context: vscode.ExtensionContext, absolutePath: string): boolean {
  const untracked = context.workspaceState.get<string[]>(UNTRACKED_REPOS_KEY, []);
  return untracked.some((repoPath) => isUnderPath(repoPath, absolutePath));
}

/** Prints `.specmesh/spec.git`'s recent commits to `outputChannel`. */
export async function showCentralHistory(outputChannel: vscode.OutputChannel): Promise<void> {
  outputChannel.clear();
  const root = findSpecGitRoot();
  if (!root) {
    outputChannel.appendLine(
      'specmesh: central doc tracking is not enabled yet. Run "specmesh: Enable Cross-Repo Doc Tracking" first.'
    );
    outputChannel.show();
    return;
  }

  const gitDir = gitDirFor(root);
  try {
    const log = await execGit(["--git-dir", gitDir, "log", "--oneline", "-20"]);
    outputChannel.appendLine(`specmesh: last commits in .specmesh/spec.git (${root.name}):`);
    outputChannel.appendLine(log.length > 0 ? log : "  (no commits yet)");
  } catch (err) {
    const message = (err as Error).message;
    if (/does not have any commits yet/i.test(message)) {
      outputChannel.appendLine(`specmesh: last commits in .specmesh/spec.git (${root.name}):`);
      outputChannel.appendLine("  (no commits yet)");
    } else {
      outputChannel.appendLine(`specmesh: could not read central history: ${message}`);
    }
  }
  outputChannel.show();
}
