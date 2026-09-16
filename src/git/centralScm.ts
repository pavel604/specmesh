import * as vscode from "vscode";
import * as path from "path";
import { execGit } from "./gitPlumbing";
import { CentralSyncScheduler, gitDirFor, isPathUntracked, isUnderPath } from "./specRepo";
import { crawlWorkspace } from "../crawler/crawler";

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

/** Whether an on-disk file's current content hash differs from what's already committed for that path. */
export function isPendingSync(onDiskSha: string, committedSha: string): boolean {
  return onDiskSha !== committedSha;
}

/** A doc's sync status relative to the central repo: never yet committed, committed but since edited, or
 * matching its last central commit exactly. `onDiskSha` is `undefined` when the file no longer exists on disk. */
export function classifySyncStatus(
  committedSha: string | undefined,
  onDiskSha: string | undefined
): "new" | "pending" | "synced" {
  if (committedSha === undefined) {
    return "new";
  }
  if (onDiskSha === undefined || isPendingSync(onDiskSha, committedSha)) {
    return "pending";
  }
  return "synced";
}

class CentralContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly gitDir: string) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const sha = uri.query;
    return execGit(["--git-dir", this.gitDir, "show", sha]);
  }
}

let activeProvider: { refresh(): Promise<void> } | undefined;

/**
 * Registers (once per session) the "specmesh (central)" Source Control view showing every specmesh-tracked doc
 * (across the whole workspace, per `crawlWorkspace()`) alongside its sync status against `.specmesh/spec.git`'s
 * `HEAD` tree: never yet synced, edited since its last central commit, or up to date. No-ops on subsequent
 * calls once already registered.
 */
export function ensureCentralScmProvider(
  root: vscode.WorkspaceFolder | undefined,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  syncScheduler: CentralSyncScheduler
): void {
  if (activeProvider || !root) {
    return;
  }

  const gitDir = gitDirFor(root);
  const workTree = root.uri.fsPath;
  const sourceControl = vscode.scm.createSourceControl("specmeshCentral", "specmesh (central)");
  sourceControl.inputBox.placeholder = "specmesh: central sync is automatic \u2014 no manual commit needed";
  const group = sourceControl.createResourceGroup("tracked", "Tracked docs");

  const refresh = async (): Promise<void> => {
    try {
      let committedTree: Map<string, string>;
      try {
        const output = await execGit(["--git-dir", gitDir, "ls-tree", "-r", "HEAD"]);
        committedTree = parseLsTree(output);
      } catch (err) {
        const message = (err as Error).message;
        if (!/not a valid object name/i.test(message)) {
          outputChannel.appendLine(`specmesh: central doc status refresh failed: ${message}`);
        }
        committedTree = new Map();
      }

      const { nodes } = await crawlWorkspace();
      const wantedRelPaths = new Set(committedTree.keys());
      for (const node of nodes) {
        if (!isUnderPath(workTree, node.absolutePath) || isPathUntracked(context, node.absolutePath)) {
          continue;
        }
        wantedRelPaths.add(path.relative(workTree, node.absolutePath).split(path.sep).join("/"));
      }

      const resourceStates: vscode.SourceControlResourceState[] = [];
      for (const relPath of wantedRelPaths) {
        const committedSha = committedTree.get(relPath);
        const absolutePath = path.join(workTree, ...relPath.split("/"));
        let onDiskSha: string | undefined;
        try {
          onDiskSha = await execGit(["--git-dir", gitDir, "hash-object", absolutePath]);
        } catch {
          onDiskSha = undefined; // file no longer on disk
        }

        const status = classifySyncStatus(committedSha, onDiskSha);
        const resourceUri = vscode.Uri.file(absolutePath);
        const tooltip = status === "new" ? "Not yet synced" : status === "pending" ? "Pending sync" : undefined;
        resourceStates.push({
          resourceUri,
          decorations: tooltip ? { tooltip, strikeThrough: false, faded: false } : undefined,
          command:
            committedSha !== undefined
              ? {
                  command: "vscode.diff",
                  title: "specmesh: Open Central Diff",
                  arguments: [
                    vscode.Uri.parse(`${CENTRAL_SCHEME}:${relPath}?${committedSha}`),
                    resourceUri,
                    `${relPath} (central \u27f7 working tree)`,
                  ],
                }
              : { command: "vscode.open", title: "Open", arguments: [resourceUri] },
        });
      }

      group.resourceStates = resourceStates;
      sourceControl.count = resourceStates.length;
    } catch (err) {
      outputChannel.appendLine(`specmesh: central doc status refresh threw unexpectedly: ${(err as Error).message}`);
    }
  };

  const contentProviderRegistration = vscode.workspace.registerTextDocumentContentProvider(
    CENTRAL_SCHEME,
    new CentralContentProvider(gitDir)
  );
  const syncSubscription = syncScheduler.onDidSync(() => void refresh());

  context.subscriptions.push(sourceControl, contentProviderRegistration, syncSubscription);
  activeProvider = { refresh };
  void refresh();
}

/** Refreshes the active central Source Control view, if one has been registered this session. */
export async function refreshCentralScm(): Promise<void> {
  await activeProvider?.refresh();
}
