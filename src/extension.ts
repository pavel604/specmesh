import * as vscode from "vscode";
import { crawlWorkspace } from "./crawler/crawler";
import { computeProblems } from "./crawler/graph";
import { DocsTreeProvider } from "./views/docsTreeProvider";
import { applyDiagnostics } from "./views/diagnostics";
import { scaffoldSdlc } from "./scaffold/scaffold";
import { openOrCreateConfig, addNewDoc } from "./scaffold/newDoc";
import { registerSpecmeshTools } from "./tools/specmeshTools";
import { DeclaredRepo, DocNode } from "./model/types";
import { enableCentralTracking, findSpecGitRoot, showCentralHistory } from "./git/specRepo";
import { migrateRepoToCentral, pickRepoTarget, untrackRepoFromCentral } from "./git/repoMigration";
import { diffDeclaredRepos, promptForNewRepos, promptForRemovedRepos, syncCloneRepos } from "./git/repoSync";
import {
  commitCentral,
  ensureCentralScmProvider,
  fetchCentral,
  manageCentralRemotes,
  pullCentral,
  pushCentral,
  refreshCentralScm,
  stageAllCentralChanges,
  stageCentralChange,
  switchCentralBranch,
  uncommitCentral,
  unstageAllCentralChanges,
  unstageCentralChange,
} from "./git/centralScm";

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

/** Renders all four counts (even when zero) so the status row's length — and therefore the tree's vertical
 * offset — stays consistent between refreshes instead of jumping. Returns `undefined` when there are zero
 * tracked docs and zero missing-tracked-file problems, so the tree is recognized as empty and its
 * `viewsWelcome` content renders instead of a blank summary. */
export function computeStatusMessage(
  docCount: number,
  missingCount: number,
  brokenLinks: number,
  orphans: number
): string | undefined {
  if (docCount === 0 && missingCount === 0) {
    return undefined;
  }
  return `${pluralize(docCount, "doc")} · ${missingCount} missing · ${pluralize(brokenLinks, "broken link")} · ${pluralize(orphans, "orphan")}`;
}

export function activate(context: vscode.ExtensionContext): void {
  const treeProvider = new DocsTreeProvider();
  const diagnostics = vscode.languages.createDiagnosticCollection("specmesh");
  const outputChannel = vscode.window.createOutputChannel("specmesh");

  const treeView = vscode.window.createTreeView("specmesh.docsExplorer", { treeDataProvider: treeProvider });

  // Baseline for detecting newly-declared/removed `repos:` entries (FR-014); `undefined` until the first
  // successful crawl, so no clone/delete prompts fire retroactively for drift that predates this session.
  let previousRepos: DeclaredRepo[] | undefined;

  const refresh = async (): Promise<void> => {
    treeView.message = "specmesh: indexing docs\u2026";
    const { nodes, missingProblems, categoryOrder, childTypeOrder, repos } = await crawlWorkspace();
    const problems = [...computeProblems(nodes), ...missingProblems];
    treeProvider.update(nodes, problems, categoryOrder, childTypeOrder, repos);
    applyDiagnostics(diagnostics, problems);

    const configExists = new Map<string, boolean>();
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      configExists.set(folder.name, await fileExists(vscode.Uri.joinPath(folder.uri, ".specmesh.yml")));
    }
    treeProvider.setConfigExistsMap(configExists);

    const brokenLinks = problems.filter((p) => p.kind === "broken-link").length;
    const orphans = problems.filter((p) => p.kind === "orphan").length;
    const missing = missingProblems.length;
    treeView.message = computeStatusMessage(nodes.length, missing, brokenLinks, orphans);

    outputChannel.appendLine(
      `specmesh: indexed ${nodes.length} docs, ${brokenLinks} broken link(s), ${orphans} orphan(s), ${missing} missing tracked file(s).`
    );

    await refreshCentralScm(nodes);

    const oldRepos = previousRepos;
    previousRepos = repos;
    if (oldRepos) {
      const { added, removed } = diffDeclaredRepos(oldRepos, repos);
      const folderNames = new Set([...added, ...removed].map((r) => r.workspaceFolderName));
      for (const folderName of folderNames) {
        const folder = vscode.workspace.workspaceFolders?.find((f) => f.name === folderName);
        if (!folder) {
          continue;
        }
        await promptForNewRepos(
          added.filter((r) => r.workspaceFolderName === folderName),
          folder,
          outputChannel
        );
        await promptForRemovedRepos(
          removed.filter((r) => r.workspaceFolderName === folderName),
          folder,
          outputChannel
        );
      }
    }
  };

  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRefresh = (): void => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(refresh, 500);
  };

  const watcher = vscode.workspace.createFileSystemWatcher("**/*.md");
  ensureCentralScmProvider(findSpecGitRoot(), context, outputChannel);
  watcher.onDidChange(() => scheduleRefresh());
  watcher.onDidCreate(() => scheduleRefresh());
  watcher.onDidDelete(() => scheduleRefresh());

  const configWatcher = vscode.workspace.createFileSystemWatcher("**/.specmesh.yml");
  configWatcher.onDidChange(scheduleRefresh);
  configWatcher.onDidCreate(scheduleRefresh);
  configWatcher.onDidDelete(scheduleRefresh);

  const settingsWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("specmesh.docTypes")) {
      scheduleRefresh();
    } else if (e.affectsConfiguration("specmesh.docLabelFormat")) {
      treeProvider.repaint();
    }
  });

  context.subscriptions.push(
    diagnostics,
    outputChannel,
    treeView,
    watcher,
    configWatcher,
    settingsWatcher,
    vscode.commands.registerCommand("specmesh.refresh", refresh),
    vscode.commands.registerCommand("specmesh.showOrphans", async () => {
      const { nodes } = await crawlWorkspace();
      const orphans = computeProblems(nodes).filter((p) => p.kind === "orphan");
      outputChannel.clear();
      outputChannel.appendLine(`specmesh: ${orphans.length} orphaned doc(s)`);
      orphans.forEach((p) => outputChannel.appendLine(`  - ${p.message}`));
      outputChannel.show();
    }),
    vscode.commands.registerCommand("specmesh.showMissing", async () => {
      const { missingProblems } = await crawlWorkspace();
      outputChannel.clear();
      outputChannel.appendLine(`specmesh: ${missingProblems.length} missing tracked file(s)`);
      missingProblems.forEach((p) => outputChannel.appendLine(`  - ${p.message}`));
      outputChannel.show();
    }),
    vscode.commands.registerCommand("specmesh.scaffoldSdlc", async () => {
      await scaffoldSdlc(context, outputChannel);
      await refresh();
    }),
    vscode.commands.registerCommand("specmesh.openOrCreateConfig", async (folderName: string) => {
      await openOrCreateConfig(folderName);
      await refresh();
    }),
    vscode.commands.registerCommand("specmesh.expandCategory", (folderName: string, type: string) => {
      treeProvider.expandCategory(folderName, type);
    }),
    vscode.commands.registerCommand("specmesh.addNewDoc", async (item: { folderName: string }) => {
      await addNewDoc(item.folderName);
      await refresh();
    }),
    vscode.commands.registerCommand("specmesh.deleteDoc", async (item: { node: DocNode }) => {
      const node = item.node;
      const confirm = await vscode.window.showWarningMessage(
        `Delete "${node.relativePath}" (${node.workspaceFolderName})?`,
        { modal: true },
        "Delete"
      );
      if (confirm !== "Delete") {
        return;
      }
      await vscode.workspace.fs.delete(vscode.Uri.file(node.absolutePath), { useTrash: true });
      await refresh();
    }),
    vscode.commands.registerCommand("specmesh.enableCentralTracking", async () => {
      const root = await enableCentralTracking(outputChannel);
      ensureCentralScmProvider(root, context, outputChannel);
    }),
    vscode.commands.registerCommand("specmesh.refreshCentralScm", async () => {
      await refreshCentralScm((await crawlWorkspace()).nodes);
    }),
    vscode.commands.registerCommand("specmesh.stageCentralChange", async (item: { resourceUri: vscode.Uri }) => {
      await stageCentralChange(item.resourceUri);
    }),
    vscode.commands.registerCommand("specmesh.unstageCentralChange", async (item: { resourceUri: vscode.Uri }) => {
      await unstageCentralChange(item.resourceUri);
    }),
    vscode.commands.registerCommand("specmesh.stageAllCentralChanges", async () => {
      await stageAllCentralChanges();
    }),
    vscode.commands.registerCommand("specmesh.unstageAllCentralChanges", async () => {
      await unstageAllCentralChanges();
    }),
    vscode.commands.registerCommand("specmesh.commitCentral", async () => {
      await commitCentral();
    }),
    vscode.commands.registerCommand("specmesh.uncommitCentral", async () => {
      await uncommitCentral();
    }),
    vscode.commands.registerCommand("specmesh.switchCentralBranch", async () => {
      await switchCentralBranch(outputChannel);
    }),
    vscode.commands.registerCommand("specmesh.manageCentralRemotes", async () => {
      await manageCentralRemotes(outputChannel);
    }),
    vscode.commands.registerCommand("specmesh.pushCentral", async () => {
      await pushCentral(outputChannel);
    }),
    vscode.commands.registerCommand("specmesh.pullCentral", async () => {
      await pullCentral(outputChannel);
    }),
    vscode.commands.registerCommand("specmesh.fetchCentral", async () => {
      await fetchCentral(outputChannel);
    }),
    vscode.commands.registerCommand("specmesh.migrateRepoDocs", async () => {
      const target = await pickRepoTarget();
      if (target) {
        await migrateRepoToCentral(target.absolutePath, outputChannel);
      }
    }),
    vscode.commands.registerCommand("specmesh.untrackRepoDocs", async () => {
      const target = await pickRepoTarget();
      if (target) {
        await untrackRepoFromCentral(target.absolutePath, context, outputChannel);
      }
    }),
    vscode.commands.registerCommand("specmesh.showCentralHistory", async () => {
      await showCentralHistory(outputChannel);
    }),
    vscode.commands.registerCommand("specmesh.syncCloneRepos", async () => {
      const { clonedSpecRepo } = await syncCloneRepos(outputChannel);
      if (clonedSpecRepo) {
        ensureCentralScmProvider(findSpecGitRoot(), context, outputChannel);
      }
      await refresh();
    }),
    ...registerSpecmeshTools(context, refresh)
  );

  void refresh();
}

export function deactivate(): void {}
