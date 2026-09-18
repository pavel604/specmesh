import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { execGit } from "./gitPlumbing";
import { ensureGitignoreEntry, findSpecGitRoot, gitDirFor } from "./specRepo";
import { toPosix } from "./repoMigration";
import { loadRepoConfig } from "../crawler/repoConfig";
import { crawlWorkspace } from "../crawler/crawler";
import { DeclaredRepo } from "../model/types";

function repoKey(repo: DeclaredRepo): string {
  return `${repo.workspaceFolderName}::${repo.path}`;
}

export interface RepoDiff {
  /** newly declared, and not yet present on disk */
  added: DeclaredRepo[];
  /** no longer declared, but still present on disk as of their last known crawl */
  removed: DeclaredRepo[];
}

/** Pure diff between two `crawlWorkspace()` snapshots' `repos` lists, keyed by workspace folder + declared
 * path. Used to drive the "new repo declared"/"repo removed" prompts without depending on vscode or git. */
export function diffDeclaredRepos(previous: DeclaredRepo[], current: DeclaredRepo[]): RepoDiff {
  const previousKeys = new Set(previous.map(repoKey));
  const currentKeys = new Set(current.map(repoKey));
  return {
    added: current.filter((r) => !previousKeys.has(repoKey(r)) && !r.present),
    removed: previous.filter((r) => !currentKeys.has(repoKey(r)) && r.present),
  };
}

export type MirrorRemoteAction = { kind: "set"; url: string } | { kind: "clear" } | { kind: "skip" };

/** Decides how the central repo's remote(s) should be mirrored into `.specmesh.yml`'s `specRepoRemote`: mirror
 * the sole remote, clear the field once there are none, or skip (leave whatever's already there) when there are
 * 2+ remotes and which one is canonical is ambiguous. Pure/testable. */
export function pickMirroredRemoteUrl(remotes: { name: string; url: string }[]): MirrorRemoteAction {
  if (remotes.length === 0) {
    return { kind: "clear" };
  }
  if (remotes.length === 1) {
    return { kind: "set", url: remotes[0].url };
  }
  return { kind: "skip" };
}

/** Logs a clone failure and shows a warning with a "Copy Terminal Command" button -- same convention as
 * centralScm.ts's push/pull/fetch failure reporting, so a bad URL/missing access can be fixed and retried by
 * running the equivalent command interactively. */
async function reportCloneFailure(
  outputChannel: vscode.OutputChannel,
  label: string,
  message: string,
  terminalCommand: string
): Promise<void> {
  outputChannel.appendLine(`specmesh: clone of "${label}" failed: ${message}`);
  const choice = await vscode.window.showWarningMessage(
    `specmesh: clone of "${label}" failed \u2014 ${message}`,
    "Copy Terminal Command"
  );
  if (choice === "Copy Terminal Command") {
    await vscode.env.clipboard.writeText(terminalCommand);
  }
}

/** Clones one declared repo to its declared `path`, then (best-effort) restores any docs already tracked for
 * that path in the central `.specmesh/spec.git` history -- covers the case of a child repo that previously had
 * its docs migrated to central-only tracking (see FR-009's `migrateRepoToCentral`), which wouldn't otherwise
 * exist in a fresh clone. Returns whether the clone itself succeeded. */
export async function cloneDeclaredRepo(
  repo: DeclaredRepo,
  root: vscode.WorkspaceFolder,
  outputChannel: vscode.OutputChannel
): Promise<boolean> {
  const absolutePath = path.join(root.uri.fsPath, repo.path);
  try {
    await execGit(["clone", repo.remote, absolutePath]);
  } catch (err) {
    await reportCloneFailure(
      outputChannel,
      repo.name,
      (err as Error).message,
      `git clone "${repo.remote}" "${absolutePath}"`
    );
    return false;
  }
  outputChannel.appendLine(`specmesh: cloned "${repo.name}" to "${absolutePath}".`);

  const specGitRoot = findSpecGitRoot();
  if (specGitRoot && specGitRoot.uri.fsPath === root.uri.fsPath) {
    const gitDir = gitDirFor(root);
    try {
      await execGit([
        "--git-dir",
        gitDir,
        "--work-tree",
        root.uri.fsPath,
        "checkout",
        "HEAD",
        "--",
        toPosix(repo.path),
      ]);
      outputChannel.appendLine(`specmesh: restored central-tracked docs under "${repo.path}".`);
    } catch (err) {
      // No commits touch this path yet -- the common case, not worth a user-facing warning.
      outputChannel.appendLine(
        `specmesh: no central-tracked docs restored under "${repo.path}" (${(err as Error).message}).`
      );
    }
  }
  return true;
}

/** The `specmesh: Sync/Clone Repos` command body: clones the central spec repo (if declared and missing), then
 * every declared child repo that isn't present on disk yet. Returns whether the central spec repo was freshly
 * cloned, so the caller can (re)register its Source Control provider. */
export async function syncCloneRepos(
  outputChannel: vscode.OutputChannel
): Promise<{ clonedSpecRepo: boolean }> {
  outputChannel.clear();
  let clonedSpecRepo = false;

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (findSpecGitRoot()) {
      continue;
    }
    const repoConfig = await loadRepoConfig(folder);
    if (!repoConfig.specRepoRemote) {
      continue;
    }
    const gitDir = gitDirFor(folder);
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, ".specmesh"));
      await execGit(["clone", "--bare", repoConfig.specRepoRemote, gitDir]);
      await ensureGitignoreEntry(folder.uri.fsPath, ".specmesh/");
      outputChannel.appendLine(`specmesh: cloned central spec repo to "${gitDir}".`);
      clonedSpecRepo = true;
    } catch (err) {
      await reportCloneFailure(
        outputChannel,
        "central spec repo",
        (err as Error).message,
        `git clone --bare "${repoConfig.specRepoRemote}" "${gitDir}"`
      );
    }
  }

  const { repos } = await crawlWorkspace();
  const missing = repos.filter((r) => !r.present);
  let clonedCount = 0;
  let failedCount = 0;
  for (const repo of missing) {
    const folder = (vscode.workspace.workspaceFolders ?? []).find((f) => f.name === repo.workspaceFolderName);
    if (!folder) {
      continue;
    }
    const ok = await cloneDeclaredRepo(repo, folder, outputChannel);
    if (ok) {
      clonedCount++;
    } else {
      failedCount++;
    }
  }

  outputChannel.appendLine(
    `specmesh: sync complete \u2014 ${clonedCount} repo(s) cloned, ${failedCount} failed, ` +
      `${repos.length - missing.length} already present.`
  );
  outputChannel.show();

  return { clonedSpecRepo };
}

/** Offers to clone each newly-declared, not-yet-present repo, one prompt at a time in declaration order. */
export async function promptForNewRepos(
  added: DeclaredRepo[],
  root: vscode.WorkspaceFolder,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  for (const repo of added) {
    const choice = await vscode.window.showInformationMessage(
      `New repo "${repo.name}" declared in .specmesh.yml. Clone it now?`,
      "Clone Now",
      "Not Now"
    );
    if (choice === "Clone Now") {
      await cloneDeclaredRepo(repo, root, outputChannel);
    }
  }
}

/** Offers to delete each removed-but-still-present repo's local folder, one prompt at a time in declaration
 * order. Keeps the folder unless the user explicitly chooses to delete it. A failed delete (e.g. the OS
 * recycle bin rejecting a large/locked folder) is reported and skipped rather than aborting the remaining
 * prompts. */
export async function promptForRemovedRepos(
  removed: DeclaredRepo[],
  root: vscode.WorkspaceFolder,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  for (const repo of removed) {
    const absolutePath = path.join(root.uri.fsPath, repo.path);
    const choice = await vscode.window.showWarningMessage(
      `Repo "${repo.name}" was removed from .specmesh.yml. Delete its local folder at "${repo.path}"? This can't be undone.`,
      { modal: true },
      "Delete Folder",
      "Keep Folder"
    );
    if (choice !== "Delete Folder") {
      continue;
    }
    // A recursive vscode.workspace.fs.delete(..., { useTrash: true }) is unreliable for large git-repo folders
    // on Windows (the OS recycle-bin API can silently fail or hang on deep .git/objects trees). Delete
    // permanently via Node's fs, matching the precedent in specRepo.ts for removing .specmesh/spec.git.
    try {
      await fs.promises.rm(absolutePath, { recursive: true, force: true });
      outputChannel.appendLine(`specmesh: deleted "${absolutePath}".`);
    } catch (err) {
      const message = (err as Error).message;
      outputChannel.appendLine(`specmesh: couldn't delete "${absolutePath}": ${message}`);
      outputChannel.show();
      vscode.window.showWarningMessage(`specmesh: couldn't delete "${repo.path}" — ${message}`);
    }
  }
}
