import * as vscode from "vscode";
import { crawlWorkspace } from "./crawler/crawler";
import { computeProblems } from "./crawler/graph";
import { DocsTreeProvider } from "./views/docsTreeProvider";
import { applyDiagnostics } from "./views/diagnostics";
import { scaffoldSdlc } from "./scaffold/scaffold";
import { openOrCreateConfig, addNewDoc } from "./scaffold/newDoc";
import { registerSpecmeshTools } from "./tools/specmeshTools";
import { DocNode } from "./model/types";
import { CentralSyncScheduler, enableCentralTracking, findSpecGitRoot, showCentralHistory } from "./git/specRepo";
import { migrateRepoToCentral, pickRepoTarget, untrackRepoFromCentral } from "./git/repoMigration";
import { ensureCentralScmProvider, refreshCentralScm } from "./git/centralScm";

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

  const refresh = async (): Promise<void> => {
    treeView.message = "specmesh: indexing docs\u2026";
    const { nodes, missingProblems, categoryOrder, repos } = await crawlWorkspace();
    const problems = [...computeProblems(nodes), ...missingProblems];
    treeProvider.update(nodes, problems, categoryOrder, repos);
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

    await refreshCentralScm();
  };

  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRefresh = (): void => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(refresh, 500);
  };

  const watcher = vscode.workspace.createFileSystemWatcher("**/*.md");
  const syncScheduler = new CentralSyncScheduler(context, outputChannel);
  ensureCentralScmProvider(findSpecGitRoot(), context, outputChannel, syncScheduler);
  watcher.onDidChange((uri) => {
    scheduleRefresh();
    syncScheduler.scheduleSync(uri.fsPath, "upsert");
  });
  watcher.onDidCreate((uri) => {
    scheduleRefresh();
    syncScheduler.scheduleSync(uri.fsPath, "upsert");
  });
  watcher.onDidDelete((uri) => {
    scheduleRefresh();
    syncScheduler.scheduleSync(uri.fsPath, "remove");
  });

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
      ensureCentralScmProvider(root, context, outputChannel, syncScheduler);
    }),
    vscode.commands.registerCommand("specmesh.refreshCentralScm", async () => {
      await refreshCentralScm();
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
    ...registerSpecmeshTools(context, refresh)
  );

  void refresh();
}

export function deactivate(): void {}
