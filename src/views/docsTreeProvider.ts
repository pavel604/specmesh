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
  private problemsByFolder = new Map<string, { missing: number; brokenLinks: number }>();
  private problemsByCategory = new Map<string, { missing: number; brokenLinks: number }>();
  private categoryOrder = new Map<string, string[]>();
  private loading = true;
  private configExists = new Map<string, boolean>();

  update(nodes: DocNode[], problems: Problem[], categoryOrder: Map<string, string[]>): void {
    this.loading = false;
    this.nodes = nodes;
    this.categoryOrder = categoryOrder;
    this.missing = problems.filter((p) => p.kind === "missing");
    this.brokenLinkCounts = new Map();
    for (const problem of problems) {
      if (problem.kind === "broken-link") {
        this.brokenLinkCounts.set(problem.absolutePath, (this.brokenLinkCounts.get(problem.absolutePath) ?? 0) + 1);
      }
    }

    this.problemsByFolder = new Map();
    this.problemsByCategory = new Map();
    const bump = (map: Map<string, { missing: number; brokenLinks: number }>, key: string, field: "missing" | "brokenLinks") => {
      const counts = map.get(key) ?? { missing: 0, brokenLinks: 0 };
      counts[field] += 1;
      map.set(key, counts);
    };
    for (const problem of this.missing) {
      if (!problem.workspaceFolderName) {
        continue;
      }
      bump(this.problemsByFolder, problem.workspaceFolderName, "missing");
      if (problem.docType) {
        bump(this.problemsByCategory, `${problem.workspaceFolderName}::${problem.docType}`, "missing");
      }
    }
    for (const node of nodes) {
      if ((this.brokenLinkCounts.get(node.absolutePath) ?? 0) > 0) {
        bump(this.problemsByFolder, node.workspaceFolderName, "brokenLinks");
        bump(this.problemsByCategory, `${node.workspaceFolderName}::${node.type}`, "brokenLinks");
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

  /** A type's position in its folder's `.specmesh.yml` track order (or the global default order, when there's
   * no per-repo config) — falls back to sorting last if a type is somehow absent from that order. */
  private categoryIndex(folderName: string, type: string): number {
    const index = this.categoryOrder.get(folderName)?.indexOf(type) ?? -1;
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }

  /** Missing tracked files (error/red) take precedence over broken links (warning/amber) when a folder or
   * category has both, matching the severity already used for individual doc/missing tree items. */
  private problemIcon(counts: { missing: number; brokenLinks: number } | undefined): vscode.ThemeIcon | undefined {
    if (!counts) {
      return undefined;
    }
    if (counts.missing > 0) {
      return new vscode.ThemeIcon("error", new vscode.ThemeColor("list.errorForeground"));
    }
    if (counts.brokenLinks > 0) {
      return new vscode.ThemeIcon("warning", new vscode.ThemeColor("list.warningForeground"));
    }
    return undefined;
  }

  private problemTooltip(counts: { missing: number; brokenLinks: number } | undefined): string | undefined {
    if (!counts) {
      return undefined;
    }
    const parts: string[] = [];
    if (counts.missing > 0) {
      parts.push(`${counts.missing} missing file${counts.missing === 1 ? "" : "s"}`);
    }
    if (counts.brokenLinks > 0) {
      parts.push(`${counts.brokenLinks} broken link${counts.brokenLinks === 1 ? "" : "s"}`);
    }
    return parts.length > 0 ? parts.join(", ") : undefined;
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
      const counts = this.problemsByFolder.get(element.folderName);
      item.iconPath = this.problemIcon(counts) ?? new vscode.ThemeIcon("repo");
      item.tooltip = this.problemTooltip(counts);
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
      const counts = this.problemsByCategory.get(`${element.folderName}::${element.type}`);
      item.iconPath = this.problemIcon(counts) ?? new vscode.ThemeIcon("folder");
      item.tooltip = this.problemTooltip(counts);
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
          .sort(([typeA], [typeB]) => this.categoryIndex(element.folderName, typeA) - this.categoryIndex(element.folderName, typeB))
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

