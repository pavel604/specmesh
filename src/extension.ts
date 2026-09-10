import * as vscode from "vscode";
import { crawlWorkspace } from "./crawler/crawler";
import { computeProblems } from "./crawler/graph";
import { DocsTreeProvider } from "./views/docsTreeProvider";
import { applyDiagnostics } from "./views/diagnostics";
import { scaffoldSdlc } from "./scaffold/scaffold";
import { registerSpecmeshTools } from "./tools/specmeshTools";

export function activate(context: vscode.ExtensionContext): void {
  const treeProvider = new DocsTreeProvider();
  const diagnostics = vscode.languages.createDiagnosticCollection("specmesh");
  const outputChannel = vscode.window.createOutputChannel("specmesh");

  const treeView = vscode.window.createTreeView("specmesh.docsExplorer", { treeDataProvider: treeProvider });

  const refresh = async (): Promise<void> => {
    treeView.message = "specmesh: indexing docs\u2026";
    const { nodes, missingProblems } = await crawlWorkspace();
    const problems = [...computeProblems(nodes), ...missingProblems];
    treeProvider.update(nodes, problems);
    applyDiagnostics(diagnostics, problems);
    treeView.message = undefined;

    const brokenLinks = problems.filter((p) => p.kind === "broken-link").length;
    const orphans = problems.filter((p) => p.kind === "orphan").length;
    const missing = missingProblems.length;
    outputChannel.appendLine(
      `specmesh: indexed ${nodes.length} docs, ${brokenLinks} broken link(s), ${orphans} orphan(s), ${missing} missing tracked file(s).`
    );
  };

  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRefresh = (): void => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(refresh, 500);
  };

  const watcher = vscode.workspace.createFileSystemWatcher("**/*.md");
  watcher.onDidChange(scheduleRefresh);
  watcher.onDidCreate(scheduleRefresh);
  watcher.onDidDelete(scheduleRefresh);

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
    ...registerSpecmeshTools(context, refresh)
  );

  void refresh();
}

export function deactivate(): void {}
