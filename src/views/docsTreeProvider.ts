import * as vscode from "vscode";
import { DocNode, Problem } from "../model/types";
import { getDocTypeDefinitions } from "../crawler/docTypes";

type LabelFormat = "title" | "filename" | "both";

// instructions/skill get their own icon so they're visually distinct from plain docs (ADRs, reference, FR-*, etc.).
// Matched by filename, not just doc type, since a repo's .specmesh.yml may lump them into one catch-all type.
function iconForDoc(type: string, fileName: string): string {
  if (type === "instructions" || fileName.endsWith(".instructions.md")) {
    return "checklist";
  }
  if (type === "skill" || fileName.toUpperCase() === "SKILL.MD") {
    return "tools";
  }
  return "book";
}

type TreeItemData =
  | { kind: "loading" }
  | { kind: "folder"; folderName: string }
  | { kind: "config"; folderName: string; exists: boolean }
  | { kind: "category"; folderName: string; type: string; label: string }
  | { kind: "doc"; node: DocNode }
  | { kind: "missing"; problem: Problem };

export class DocsTreeProvider implements vscode.TreeDataProvider<TreeItemData> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private nodes: DocNode[] = [];
  private missing: Problem[] = [];
  private brokenLinkCounts = new Map<string, number>();
  private loading = true;
  private configExists = new Map<string, boolean>();

  update(nodes: DocNode[], problems: Problem[]): void {
    this.loading = false;
    this.nodes = nodes;
    this.missing = problems.filter((p) => p.kind === "missing");
    this.brokenLinkCounts = new Map();
    for (const problem of problems) {
      if (problem.kind === "broken-link") {
        this.brokenLinkCounts.set(problem.absolutePath, (this.brokenLinkCounts.get(problem.absolutePath) ?? 0) + 1);
      }
    }
    this._onDidChangeTreeData.fire();
  }

  /** Tracked per folder so the pinned config node can render its exists/not-created state without an async
   * filesystem check on every tree render. */
  setConfigExistsMap(configExists: Map<string, boolean>): void {
    this.configExists = configExists;
    this._onDidChangeTreeData.fire();
  }

  private labelFormat(): LabelFormat {
    return vscode.workspace.getConfiguration("specmesh").get<LabelFormat>("docLabelFormat") ?? "both";
  }

  /** Re-renders with the current data (e.g. after a docLabelFormat setting change) without re-crawling. */
  repaint(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItemData): vscode.TreeItem {
    if (element.kind === "loading") {
      const item = new vscode.TreeItem("Loading docs…", vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon("loading~spin");
      return item;
    }

    if (element.kind === "folder") {
      const item = new vscode.TreeItem(element.folderName, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon("repo");
      item.contextValue = "folder";
      return item;
    }

    if (element.kind === "config") {
      const item = new vscode.TreeItem(".specmesh.yml", vscode.TreeItemCollapsibleState.None);
      const folder = vscode.workspace.workspaceFolders?.find((f) => f.name === element.folderName);
      if (element.exists && folder) {
        item.resourceUri = vscode.Uri.joinPath(folder.uri, ".specmesh.yml");
        item.tooltip = "Open .specmesh.yml";
        item.iconPath = new vscode.ThemeIcon("gear");
      } else {
        item.description = "not created";
        item.tooltip = "Create .specmesh.yml";
        item.iconPath = new vscode.ThemeIcon("gear", new vscode.ThemeColor("disabledForeground"));
      }
      item.command = {
        command: "specmesh.openOrCreateConfig",
        title: "Open or Create .specmesh.yml",
        arguments: [element.folderName],
      };
      return item;
    }

    if (element.kind === "category") {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscode.ThemeIcon("folder");
      return item;
    }

    if (element.kind === "missing") {
      const item = new vscode.TreeItem(
        element.problem.expectedPath ?? element.problem.message,
        vscode.TreeItemCollapsibleState.None
      );
      item.description = "missing";
      item.tooltip = element.problem.message;
      item.iconPath = new vscode.ThemeIcon("error", new vscode.ThemeColor("list.errorForeground"));
      return item;
    }

    return this.getDocTreeItem(element.node);
  }


  private getDocTreeItem(node: DocNode): vscode.TreeItem {
    const fileName = node.relativePath.split("/").pop() ?? node.relativePath;
    const format = this.labelFormat();
    const label = format === "filename" ? fileName : node.title;
    const secondary = format === "title" ? undefined : format === "filename" ? node.title : fileName;
    const description = [secondary, node.metadata["Status"]].filter(Boolean).join(" · ");

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = description;
    item.tooltip = node.relativePath;
    item.contextValue = "doc";
    // lets VS Code's built-in git decorations (modified/added color+badge) apply to this item for free
    item.resourceUri = vscode.Uri.file(node.absolutePath);

    const brokenLinks = this.brokenLinkCounts.get(node.absolutePath) ?? 0;
    item.iconPath =
      brokenLinks > 0
        ? new vscode.ThemeIcon("warning", new vscode.ThemeColor("list.warningForeground"))
        : new vscode.ThemeIcon(iconForDoc(node.type, fileName));

    item.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [vscode.Uri.file(node.absolutePath)],
    };
    return item;
  }

  getChildren(element?: TreeItemData): TreeItemData[] {
    if (!element) {
      if (this.loading) {
        return [{ kind: "loading" }];
      }
      const folderNames = new Set<string>([
        ...this.nodes.map((n) => n.workspaceFolderName),
        ...this.missing.map((p) => p.workspaceFolderName).filter((n): n is string => !!n),
      ]);
      return [...folderNames].sort().map((folderName) => ({ kind: "folder", folderName }));
    }

    if (element.kind === "folder") {
      const nodesInFolder = this.nodes.filter((n) => n.workspaceFolderName === element.folderName);
      const missingInFolder = this.missing.filter((p) => p.workspaceFolderName === element.folderName);

      // preserve the built-in doc-type order, then append any custom types a repo's .specmesh.yml added
      const categoryLabels = new Map<string, string>();
      for (const def of getDocTypeDefinitions()) {
        categoryLabels.set(def.type, def.label);
      }
      for (const node of nodesInFolder) {
        if (!categoryLabels.has(node.type)) {
          categoryLabels.set(node.type, node.categoryLabel);
        }
      }
      for (const problem of missingInFolder) {
        if (problem.docType && !categoryLabels.has(problem.docType)) {
          categoryLabels.set(problem.docType, problem.categoryLabel ?? problem.docType);
        }
      }

      const presentTypes = new Set([
        ...nodesInFolder.map((n) => n.type),
        ...missingInFolder.map((p) => p.docType).filter((t): t is string => !!t),
      ]);

      const configItem: TreeItemData = {
        kind: "config",
        folderName: element.folderName,
        exists: this.configExists.get(element.folderName) ?? false,
      };

      return [
        configItem,
        ...[...categoryLabels.entries()]
          .filter(([type]) => presentTypes.has(type))
          .map(([type, label]): TreeItemData => ({ kind: "category", folderName: element.folderName, type, label })),
      ];
    }

    if (element.kind === "category") {
      const docs: TreeItemData[] = this.nodes
        .filter((n) => n.workspaceFolderName === element.folderName && n.type === element.type)
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((node) => ({ kind: "doc", node }));
      const missing: TreeItemData[] = this.missing
        .filter((p) => p.workspaceFolderName === element.folderName && p.docType === element.type)
        .map((problem) => ({ kind: "missing", problem }));
      return [...missing, ...docs];
    }

    return [];
  }
}

