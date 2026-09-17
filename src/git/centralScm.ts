import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execGit } from "./gitPlumbing";
import { gitDirFor, isPathUntracked, isUnderPath } from "./specRepo";
import { crawlWorkspace } from "../crawler/crawler";
import { DocNode } from "../model/types";

const CENTRAL_SCHEME = "specmesh-central";

/** Parses `git ls-tree -r HEAD` output (`<mode> blob <sha>\t<path>` per line) into a path -> blob-sha map. */
export function parseLsTree(output: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const tabIndex = line.indexOf("\t");
    if (tabIndex === -1) {
      continue;
    }
    const meta = line.slice(0, tabIndex).trim().split(/\s+/);
    const relPath = line.slice(tabIndex + 1);
    const sha = meta[2];
    if (sha) {
      result.set(relPath, sha);
    }
  }
  return result;
}

/** Parses `git ls-files --stage` output (`<mode> <sha> <stage>\t<path>` per line) into a path -> blob-sha map
 * for the index. */
export function parseLsFilesStage(output: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const tabIndex = line.indexOf("\t");
    if (tabIndex === -1) {
      continue;
    }
    const meta = line.slice(0, tabIndex).trim().split(/\s+/);
    const relPath = line.slice(tabIndex + 1);
    const sha = meta[1];
    if (sha) {
      result.set(relPath, sha);
    }
  }
  return result;
}

/** Buckets every candidate path into `staged` (index differs from `HEAD`) and/or `changes` (working tree
 * differs from index) -- a path identical across all three snapshots appears in neither list. */
export function computeChangeGroups(
  headTree: Map<string, string>,
  indexTree: Map<string, string>,
  onDiskShas: Map<string, string | undefined>,
  candidatePaths: Iterable<string>
): { staged: string[]; changes: string[] } {
  const staged: string[] = [];
  const changes: string[] = [];
  for (const relPath of candidatePaths) {
    const headSha = headTree.get(relPath);
    const indexSha = indexTree.get(relPath);
    const onDiskSha = onDiskShas.get(relPath);
    if (indexSha !== headSha) {
      staged.push(relPath);
    }
    if (onDiskSha !== indexSha) {
      changes.push(relPath);
    }
  }
  return { staged, changes };
}

/** Parses `git branch --list` output (`* main` / `  feature-x`) into `{ name, current }` entries. */
export function parseBranchList(output: string): { name: string; current: boolean }[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const current = line.startsWith("*");
      const name = current ? line.slice(1).trim() : line;
      return { name, current };
    });
}

/** Extracts the file paths git lists in its "local changes ... would be overwritten by checkout" error. */
export function parseCheckoutConflictFiles(stderr: string): string[] {
  if (!/would be overwritten by checkout/i.test(stderr)) {
    return [];
  }
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^(error|please|aborting|hint)/i.test(line));
}

class CentralContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly gitDir: string) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const sha = uri.query;
    return execGit(["--git-dir", this.gitDir, "show", sha]);
  }
}

function centralUri(relPath: string, sha: string): vscode.Uri {
  return vscode.Uri.parse(`${CENTRAL_SCHEME}:${relPath}?${sha}`);
}

interface ActiveProvider {
  refresh(freshNodes?: DocNode[]): Promise<void>;
  root: vscode.WorkspaceFolder;
  sourceControl: vscode.SourceControl;
  stagedGroup: vscode.SourceControlResourceGroup;
  changesGroup: vscode.SourceControlResourceGroup;
}

let activeProvider: ActiveProvider | undefined;

/**
 * Registers (once per session) the "specmesh (central)" Source Control view showing every specmesh-tracked doc
 * (across the whole workspace, per `crawlWorkspace()`) split into **Staged Changes** (index vs. `HEAD`) and
 * **Changes** (working tree vs. index). No-ops on subsequent calls once already registered.
 */
export function ensureCentralScmProvider(
  root: vscode.WorkspaceFolder | undefined,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): void {
  if (activeProvider || !root) {
    return;
  }

  const gitDir = gitDirFor(root);
  const workTree = root.uri.fsPath;
  const sourceControl = vscode.scm.createSourceControl("specmeshCentral", "specmesh (central)");
  sourceControl.inputBox.placeholder = "specmesh: commit message for .specmesh/spec.git";
  sourceControl.acceptInputCommand = { command: "specmesh.commitCentral", title: "Commit" };
  const stagedGroup = sourceControl.createResourceGroup("staged", "Staged Changes");
  const changesGroup = sourceControl.createResourceGroup("changes", "Changes");

  // Cached across refreshes: staging/unstaging/committing don't change which files exist on disk, so those
  // actions can reuse the last crawl instead of paying for another full `crawlWorkspace()` (which walks the
  // whole workspace via `vscode.workspace.findFiles`). Only a fresh crawl (branch switch, or the doc watcher's
  // own already-in-hand nodes) needs to replace it.
  let cachedNodes: DocNode[] | undefined;

  const refresh = async (freshNodes?: DocNode[]): Promise<void> => {
    try {
      // Every git spawn has noticeable overhead (especially on Windows), so run the independent ones
      // concurrently instead of one after another.
      const [headTreeResult, indexTreeResult, branchResult, nodes] = await Promise.all([
        execGit(["--git-dir", gitDir, "ls-tree", "-r", "HEAD"]).then(
          (output) => ({ ok: true as const, value: parseLsTree(output) }),
          (err) => ({ ok: false as const, err: err as Error })
        ),
        execGit(["--git-dir", gitDir, "--work-tree", workTree, "ls-files", "--stage"]).then(
          (output) => ({ ok: true as const, value: parseLsFilesStage(output) }),
          () => ({ ok: false as const, err: undefined })
        ),
        execGit(["--git-dir", gitDir, "--work-tree", workTree, "rev-parse", "--abbrev-ref", "HEAD"]).then(
          (branch) => ({ ok: true as const, value: branch }),
          () => ({ ok: false as const, err: undefined })
        ),
        freshNodes ?? cachedNodes ?? crawlWorkspace().then((r) => r.nodes),
      ]);
      cachedNodes = nodes;

      let headTree: Map<string, string>;
      if (headTreeResult.ok) {
        headTree = headTreeResult.value;
      } else {
        const message = headTreeResult.err.message;
        if (!/not a valid object name/i.test(message)) {
          outputChannel.appendLine(`specmesh: central doc status refresh failed: ${message}`);
        }
        headTree = new Map();
      }

      const indexTree = indexTreeResult.ok ? indexTreeResult.value : new Map<string, string>();

      const candidatePaths = new Set([...headTree.keys(), ...indexTree.keys()]);
      for (const node of nodes) {
        if (!isUnderPath(workTree, node.absolutePath) || isPathUntracked(context, node.absolutePath)) {
          continue;
        }
        candidatePaths.add(path.relative(workTree, node.absolutePath).split(path.sep).join("/"));
      }

      // Batched into a single `hash-object --stdin-paths` call instead of one subprocess per path -- the
      // per-path version made refresh() (and anything awaiting it, like stage/unstage) noticeably slow once
      // there were more than a handful of tracked docs.
      const onDiskShas = new Map<string, string | undefined>();
      const existingRelPaths: string[] = [];
      const existingAbsPaths: string[] = [];
      for (const relPath of candidatePaths) {
        const absolutePath = path.join(workTree, ...relPath.split("/"));
        if (fs.existsSync(absolutePath)) {
          existingRelPaths.push(relPath);
          existingAbsPaths.push(absolutePath);
        } else {
          onDiskShas.set(relPath, undefined);
        }
      }
      if (existingAbsPaths.length > 0) {
        const output = await execGit(["--git-dir", gitDir, "hash-object", "--stdin-paths"], {
          input: existingAbsPaths.join("\n") + "\n",
        });
        const shas = output.split(/\r?\n/).filter((l) => l.length > 0);
        existingRelPaths.forEach((relPath, i) => onDiskShas.set(relPath, shas[i]));
      }

      const { staged, changes } = computeChangeGroups(headTree, indexTree, onDiskShas, candidatePaths);

      const toResourceState = (
        relPath: string,
        staleSha: string | undefined,
        freshSha: string | undefined
      ): vscode.SourceControlResourceState => {
        const absolutePath = path.join(workTree, ...relPath.split("/"));
        const resourceUri = vscode.Uri.file(absolutePath);
        return {
          resourceUri,
          command:
            staleSha !== undefined
              ? {
                  command: "vscode.diff",
                  title: "specmesh: Open Central Diff",
                  arguments: [
                    centralUri(relPath, staleSha),
                    freshSha !== undefined ? centralUri(relPath, freshSha) : resourceUri,
                    `${relPath} (central \u27f7 working tree)`,
                  ],
                }
              : { command: "vscode.open", title: "Open", arguments: [resourceUri] },
        };
      };

      stagedGroup.resourceStates = staged.map((relPath) =>
        toResourceState(relPath, headTree.get(relPath), indexTree.get(relPath))
      );
      changesGroup.resourceStates = changes.map((relPath) =>
        toResourceState(relPath, indexTree.get(relPath) ?? headTree.get(relPath), onDiskShas.get(relPath))
      );
      sourceControl.count = staged.length + changes.length;

      sourceControl.statusBarCommands = branchResult.ok
        ? [
            {
              command: "specmesh.switchCentralBranch",
              title: `$(git-branch) ${branchResult.value}`,
              tooltip: "specmesh: Switch Central Branch",
            },
          ]
        : [];
    } catch (err) {
      outputChannel.appendLine(`specmesh: central doc status refresh threw unexpectedly: ${(err as Error).message}`);
    }
  };

  const contentProviderRegistration = vscode.workspace.registerTextDocumentContentProvider(
    CENTRAL_SCHEME,
    new CentralContentProvider(gitDir)
  );

  context.subscriptions.push(sourceControl, contentProviderRegistration);
  activeProvider = { refresh, root, sourceControl, stagedGroup, changesGroup };
  void refresh();
}

/** Refreshes the active central Source Control view, if one has been registered this session. Pass `nodes`
 * when the caller already has a fresh `crawlWorkspace()` result (e.g. the doc watcher's own refresh), so this
 * doesn't pay for a second full workspace crawl. */
export async function refreshCentralScm(nodes?: DocNode[]): Promise<void> {
  await activeProvider?.refresh(nodes);
}

function relPathFromUri(workTree: string, uri: vscode.Uri): string {
  return path.relative(workTree, uri.fsPath).split(path.sep).join("/");
}

async function stagePaths(root: vscode.WorkspaceFolder, relPaths: string[]): Promise<void> {
  if (relPaths.length === 0) {
    return;
  }
  const gitDir = gitDirFor(root);
  const workTree = root.uri.fsPath;
  const absPaths = relPaths.map((relPath) => path.join(workTree, ...relPath.split("/")));
  // Deliberately low-level plumbing instead of `git add`: `add` treats any path under a nested repo's own
  // `.git` (e.g. a child repo declared via `.specmesh.yml` `repos:`) as a submodule boundary and silently
  // skips it, whereas `hash-object` + `update-index --index-info` don't care about that boundary at all.
  const hashOutput = await execGit(["--git-dir", gitDir, "hash-object", "-w", "--stdin-paths"], {
    input: absPaths.join("\n") + "\n",
  });
  const shas = hashOutput.split(/\r?\n/).filter((l) => l.length > 0);
  const indexInfo = relPaths.map((relPath, i) => `100644 ${shas[i]} 0\t${relPath}`).join("\n") + "\n";
  await execGit(["--git-dir", gitDir, "--work-tree", workTree, "update-index", "--add", "--index-info"], {
    input: indexInfo,
  });
}

async function unstagePaths(root: vscode.WorkspaceFolder, relPaths: string[]): Promise<void> {
  if (relPaths.length === 0) {
    return;
  }
  const gitDir = gitDirFor(root);
  const workTree = root.uri.fsPath;
  // `reset HEAD -- <paths>` handles both cases in one call: resets an already-committed path's index entry
  // back to HEAD's blob, and drops a never-committed path from the index entirely.
  await execGit(["--git-dir", gitDir, "--work-tree", workTree, "reset", "HEAD", "--", ...relPaths]);
}

/** Stages a single path. */
export async function stageCentralChange(uri: vscode.Uri): Promise<void> {
  if (!activeProvider) {
    return;
  }
  await stagePaths(activeProvider.root, [relPathFromUri(activeProvider.root.uri.fsPath, uri)]);
  await activeProvider.refresh();
}

/** Stages every currently-unstaged change in one batched `git add`. */
export async function stageAllCentralChanges(): Promise<void> {
  if (!activeProvider) {
    return;
  }
  const workTree = activeProvider.root.uri.fsPath;
  const relPaths = activeProvider.changesGroup.resourceStates.map((s) => relPathFromUri(workTree, s.resourceUri));
  await stagePaths(activeProvider.root, relPaths);
  await activeProvider.refresh();
}

/** Unstages a single path. */
export async function unstageCentralChange(uri: vscode.Uri): Promise<void> {
  if (!activeProvider) {
    return;
  }
  await unstagePaths(activeProvider.root, [relPathFromUri(activeProvider.root.uri.fsPath, uri)]);
  await activeProvider.refresh();
}

/** Unstages every currently-staged change in one batched `git reset`. */
export async function unstageAllCentralChanges(): Promise<void> {
  if (!activeProvider) {
    return;
  }
  const workTree = activeProvider.root.uri.fsPath;
  const relPaths = activeProvider.stagedGroup.resourceStates.map((s) => relPathFromUri(workTree, s.resourceUri));
  await unstagePaths(activeProvider.root, relPaths);
  await activeProvider.refresh();
}

/** Commits everything currently in **Staged Changes** using the SCM input box's message. Warns instead of
 * committing if the message is blank or nothing is staged. */
export async function commitCentral(): Promise<void> {
  if (!activeProvider) {
    return;
  }
  const message = activeProvider.sourceControl.inputBox.value.trim();
  if (activeProvider.stagedGroup.resourceStates.length === 0) {
    vscode.window.showWarningMessage("specmesh: nothing staged to commit.");
    return;
  }
  if (!message) {
    vscode.window.showWarningMessage("specmesh: enter a commit message first.");
    return;
  }

  const gitDir = gitDirFor(activeProvider.root);
  const workTree = activeProvider.root.uri.fsPath;
  await execGit(["--git-dir", gitDir, "--work-tree", workTree, "commit", "-m", message]);
  activeProvider.sourceControl.inputBox.value = "";
  await activeProvider.refresh();
}

/** Reverses the last commit via a soft reset to its parent -- the undone commit's changes land back in
 * **Staged Changes** rather than being discarded, matching the built-in Git view's "Undo Last Commit". Warns
 * instead of resetting if there's no parent commit to reset to. */
export async function uncommitCentral(): Promise<void> {
  if (!activeProvider) {
    return;
  }
  const gitDir = gitDirFor(activeProvider.root);
  const workTree = activeProvider.root.uri.fsPath;
  try {
    await execGit(["--git-dir", gitDir, "--work-tree", workTree, "reset", "--soft", "HEAD~1"]);
  } catch {
    vscode.window.showWarningMessage("specmesh: nothing to undo.");
    return;
  }
  await activeProvider.refresh();
}

/** Opens a QuickPick of the central repo's branches (plus "Create new branch..."), checks out the selection,
 * and surfaces a would-be-overwritten-files warning instead of only logging it if checkout is rejected. */
export async function switchCentralBranch(outputChannel: vscode.OutputChannel): Promise<void> {
  if (!activeProvider) {
    return;
  }
  const gitDir = gitDirFor(activeProvider.root);
  const workTree = activeProvider.root.uri.fsPath;

  const output = await execGit(["--git-dir", gitDir, "branch", "--list"]);
  const branches = parseBranchList(output);
  const createNewLabel = "$(add) Create new branch\u2026";
  const pick = await vscode.window.showQuickPick(
    [
      ...branches.map((b) => ({ label: b.current ? `$(check) ${b.name}` : b.name, name: b.name as string | undefined })),
      { label: createNewLabel, name: undefined },
    ],
    { placeHolder: "specmesh: switch central branch" }
  );
  if (!pick) {
    return;
  }

  let checkoutArgs: string[];
  if (pick.name) {
    checkoutArgs = ["checkout", pick.name];
  } else {
    const name = await vscode.window.showInputBox({ prompt: "specmesh: new branch name" });
    if (!name) {
      return;
    }
    checkoutArgs = ["checkout", "-b", name];
  }

  try {
    await execGit(["--git-dir", gitDir, "--work-tree", workTree, ...checkoutArgs]);
    // Checkout can add/remove/change files on disk, so the cached crawl from the last refresh is no longer
    // trustworthy here -- force a fresh one instead of reusing it.
    await activeProvider.refresh((await crawlWorkspace()).nodes);
  } catch (err) {
    const message = (err as Error).message;
    const conflicts = parseCheckoutConflictFiles(message);
    if (conflicts.length > 0) {
      vscode.window.showWarningMessage(
        `specmesh: can't switch branch \u2014 stage or commit changes to ${conflicts.join(", ")} first.`
      );
    } else {
      outputChannel.appendLine(`specmesh: branch switch failed: ${message}`);
      vscode.window.showWarningMessage(
        "specmesh: branch switch failed. See the specmesh output channel for details."
      );
    }
  }
}
