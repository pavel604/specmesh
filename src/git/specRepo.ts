import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execGit, isGitAvailable } from "./gitPlumbing";

const SPEC_GIT_RELATIVE_PATH = path.join(".specmesh", "spec.git");
const UNTRACKED_REPOS_KEY = "specmesh.untrackedRepos";
const SYNC_DEBOUNCE_MS = 500;

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

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

/** `paths.length` short-circuits to a count-only summary once the list would make an unwieldy commit subject
 * line; short lists are spelled out so `git log --oneline` still shows something useful. */
export function formatCommitMessage(paths: string[]): string {
  if (paths.length <= 5) {
    return `specmesh: sync ${paths.length} doc(s): ${paths.join(", ")}`;
  }
  return `specmesh: sync ${paths.length} doc(s)`;
}

type SyncKind = "upsert" | "remove";

/** Debounces per-save doc changes and batches them into one `.specmesh/spec.git` commit per quiet period. */
export class CentralSyncScheduler {
  private pending = new Map<string, SyncKind>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private warned = false;
  private readonly _onDidSync = new vscode.EventEmitter<void>();
  /** Fires after each successful central commit, so a UI (e.g. the central Source Control view) can refresh
   * without polling. Does not fire for a no-op ("nothing to commit") flush. */
  readonly onDidSync = this._onDidSync.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  scheduleSync(absolutePath: string, kind: SyncKind): void {
    if (isPathUntracked(this.context, absolutePath)) {
      return;
    }
    if (!findSpecGitRoot()) {
      return;
    }
    this.pending.set(absolutePath, kind);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => void this.flush(), SYNC_DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    const root = findSpecGitRoot();
    const entries = [...this.pending.entries()];
    this.pending.clear();
    if (!root || entries.length === 0) {
      return;
    }

    const gitDir = gitDirFor(root);
    const workTree = root.uri.fsPath;
    const changedRelPaths: string[] = [];

    try {
      for (const [absolutePath, kind] of entries) {
        const relPath = toPosix(path.relative(workTree, absolutePath));
        if (kind === "upsert") {
          if (!fs.existsSync(absolutePath)) {
            continue;
          }
          const sha = await execGit(["--git-dir", gitDir, "hash-object", "-w", absolutePath]);
          await execGit([
            "--git-dir",
            gitDir,
            "--work-tree",
            workTree,
            "update-index",
            "--add",
            "--cacheinfo",
            `100644,${sha},${relPath}`,
          ]);
        } else {
          await execGit(["--git-dir", gitDir, "--work-tree", workTree, "update-index", "--remove", "--", relPath]);
        }
        changedRelPaths.push(relPath);
      }

      if (changedRelPaths.length > 0) {
        try {
          await execGit([
            "--git-dir",
            gitDir,
            "--work-tree",
            workTree,
            "commit",
            "-m",
            formatCommitMessage(changedRelPaths),
          ]);
          this.outputChannel.appendLine(
            `specmesh: synced ${changedRelPaths.length} doc(s) to .specmesh/spec.git`
          );
          this._onDidSync.fire();
        } catch (err) {
          const message = (err as Error).message;
          if (!/nothing to commit|nothing added to commit/i.test(message)) {
            throw err;
          }
        }
      }
      this.warned = false;
    } catch (err) {
      this.outputChannel.appendLine(`specmesh: central doc sync failed: ${(err as Error).message}`);
      if (!this.warned) {
        this.warned = true;
        vscode.window.showWarningMessage(
          "specmesh: central doc tracking sync failed. See the specmesh output channel for details."
        );
      }
    }
  }
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
