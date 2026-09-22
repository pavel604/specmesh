import * as vscode from "vscode";
import { DeclaredRepo, DocNode, Problem } from "../model/types";
import { getDocTypeDefinitions } from "../crawler/docTypes";
import { sortDocsReverseChronological } from "../crawler/docTypeTree";
import { iconForDoc } from "./docIcon";

// keeps a first-ever feature's docs from pushing the rest of a long category off-screen -- "Show N more…"
// (see TreeItemData's "more" kind) reveals the rest on demand.
const MAX_VISIBLE_DOCS_PER_CATEGORY = 10;

type LabelFormat = "title" | "filename" | "both";

/** Case-insensitive substring match against a doc's title or filename -- the same two fields the tree already
 * renders per `specmesh.docLabelFormat`, not the doc's full markdown body. */
export function docMatchesFilter(title: string, filename: string, filterText: string): boolean {
  const needle = filterText.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return title.toLowerCase().includes(needle) || filename.toLowerCase().includes(needle);
}

// "Declared Repos" (repos:) isn't a doc type from getDocTypeDefinitions(), so its category label needs a
// constant of its own -- must match the categoryLabel crawler.ts uses for repo-manifest Problems.
const REPO_MANIFEST_TYPE = "repo-manifest";
const REPO_MANIFEST_LABEL = "Declared Repos";

type TreeItemData =
  | { kind: "loading" }
  | { kind: "folder"; folderName: string }
  | { kind: "config"; folderName: string; exists: boolean }
  | { kind: "category"; folderName: string; type: string; label: string }
  | { kind: "doc"; node: DocNode }
  | { kind: "repo"; repo: DeclaredRepo }
  | { kind: "missing"; problem: Problem }
  | { kind: "more"; folderName: string; type: string; remaining: number };

export class DocsTreeProvider implements vscode.TreeDataProvider<TreeItemData> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private nodes: DocNode[] = [];
  private missing: Problem[] = [];
  private repos: DeclaredRepo[] = [];
  private brokenLinkCounts = new Map<string, number>();
  private problemsByFolder = new Map<string, { missing: number; brokenLinks: number }>();
  private problemsByCategory = new Map<string, { missing: number; brokenLinks: number }>();
  private categoryOrder = new Map<string, string[]>();
  private childTypeOrder = new Map<string, string[]>();
  private loading = true;
  private configExists = new Map<string, boolean>();
  // categories the user has chosen to fully expand past the MAX_VISIBLE_DOCS_PER_CATEGORY cap, keyed
  // `${folderName}::${type}` -- persists across refreshes so it doesn't re-collapse on every file watch tick.
  private expandedCategories = new Set<string>();
  // live search filter (FR-017) -- empty string means "no filter, show everything", matching today's behavior.
  private filterText = "";

  setFilter(text: string): void {
    this.filterText = text.trim();
    this._onDidChangeTreeData.fire();
  }

  getFilter(): string {
    return this.filterText;
  }

  update(
    nodes: DocNode[],
    problems: Problem[],
    categoryOrder: Map<string, string[]>,
    childTypeOrder: Map<string, string[]> = new Map(),
    repos: DeclaredRepo[] = []
  ): void {
    this.loading = false;
    this.nodes = nodes;
    this.categoryOrder = categoryOrder;
    this.childTypeOrder = childTypeOrder;
    this.repos = repos;
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

  /** A doc's nested children, in the parent type's declared `children` order (falls back to type then
   * title when a child's type isn't in that order, which shouldn't normally happen). */
  private childrenOf(node: DocNode): DocNode[] {
    const kids = this.nodes.filter((n) => n.parentId === node.id);
    const order = this.childTypeOrder.get(`${node.workspaceFolderName}::${node.type}`) ?? [];
    const orderIndex = (type: string): number => {
      const index = order.indexOf(type);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    return kids.sort(
      (a, b) => orderIndex(a.type) - orderIndex(b.type) || a.type.localeCompare(b.type) || a.title.localeCompare(b.title)
    );
  }

  /** A doc is visible under the active filter if it matches directly, or any of its nested children
   * (recursively) do -- once visible this way, its children still render unfiltered (FR-3). No-op (always
   * true) when there's no active filter. */
  private isVisible(node: DocNode): boolean {
    if (!this.filterText) {
      return true;
    }
    const fileName = node.relativePath.split("/").pop() ?? node.relativePath;
    if (docMatchesFilter(node.title, fileName, this.filterText)) {
      return true;
    }
    return this.childrenOf(node).some((child) => this.isVisible(child));
  }

  /** Every nested descendant of `node` renders unconditionally once `node` itself is shown (FR-3), regardless
   * of whether each descendant individually matches the filter. */
  private countRenderedDescendants(node: DocNode): number {
    return this.childrenOf(node).reduce((sum, child) => sum + 1 + this.countRenderedDescendants(child), 0);
  }

  /** Total tracked docs with no active filter; otherwise the count of docs actually rendered under the
   * current filter, so the status row's "N docs" reflects what's shown rather than the workspace total. */
  visibleDocCount(): number {
    if (!this.filterText) {
      return this.nodes.length;
    }
    return this.nodes
      .filter((n) => !n.parentId && this.isVisible(n))
      .reduce((sum, n) => sum + 1 + this.countRenderedDescendants(n), 0);
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

  /** Lifts the MAX_VISIBLE_DOCS_PER_CATEGORY cap for one category, invoked by its "Show N more…" item. */
  expandCategory(folderName: string, type: string): void {
    this.expandedCategories.add(`${folderName}::${type}`);
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

    if (element.kind === "more") {
      const item = new vscode.TreeItem(`Show ${element.remaining} more…`, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon("ellipsis");
      item.command = {
        command: "specmesh.expandCategory",
        title: "Show More Docs",
        arguments: [element.folderName, element.type],
      };
      return item;
    }

    if (element.kind === "repo") {
      const item = new vscode.TreeItem(element.repo.name, vscode.TreeItemCollapsibleState.None);
      item.description = element.repo.path;
      item.tooltip = `${element.repo.remote}\n${element.repo.path}`;
      item.iconPath = new vscode.ThemeIcon("repo");
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

    const hasChildren = this.nodes.some((n) => n.parentId === node.id);
    const item = new vscode.TreeItem(
      label,
      hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );
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
        ...this.repos.map((r) => r.workspaceFolderName),
      ]);
      const visibleFolderNames = this.filterText
        ? [...folderNames].filter((folderName) =>
            this.nodes.some((n) => n.workspaceFolderName === folderName && !n.parentId && this.isVisible(n))
          )
        : [...folderNames];
      return visibleFolderNames.sort().map((folderName) => ({ kind: "folder", folderName }));
    }

    if (element.kind === "folder") {
      const nodesInFolder = this.nodes.filter((n) => n.workspaceFolderName === element.folderName);
      // while a filter is active, missing-tracked-file entries and Declared Repos aren't matchable docs, so
      // they're omitted entirely rather than filtered by title/filename (FR-2).
      const missingInFolder = this.filterText
        ? []
        : this.missing.filter((p) => p.workspaceFolderName === element.folderName);
      const reposInFolder = this.filterText ? [] : this.repos.filter((r) => r.workspaceFolderName === element.folderName);

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
      if (reposInFolder.length > 0 && !categoryLabels.has(REPO_MANIFEST_TYPE)) {
        categoryLabels.set(REPO_MANIFEST_TYPE, REPO_MANIFEST_LABEL);
      }

      const presentTypes = new Set([
        ...nodesInFolder
          .filter((n) => !n.parentId && (!this.filterText || this.isVisible(n)))
          .map((n) => n.type),
        ...missingInFolder.map((p) => p.docType).filter((t): t is string => !!t),
        ...(reposInFolder.length > 0 ? [REPO_MANIFEST_TYPE] : []),
      ]);

      const configItem: TreeItemData[] = this.filterText
        ? []
        : [{ kind: "config", folderName: element.folderName, exists: this.configExists.get(element.folderName) ?? false }];

      return [
        ...configItem,
        ...[...categoryLabels.entries()]
          .filter(([type]) => presentTypes.has(type))
          .sort(([typeA], [typeB]) => this.categoryIndex(element.folderName, typeA) - this.categoryIndex(element.folderName, typeB))
          .map(([type, label]): TreeItemData => ({ kind: "category", folderName: element.folderName, type, label })),
      ];
    }

    if (element.kind === "category") {
      if (element.type === REPO_MANIFEST_TYPE) {
        const missing: TreeItemData[] = this.missing
          .filter((p) => p.workspaceFolderName === element.folderName && p.docType === REPO_MANIFEST_TYPE)
          .map((problem) => ({ kind: "missing", problem }));
        const present: TreeItemData[] = this.repos
          .filter((r) => r.workspaceFolderName === element.folderName && r.present)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((repo) => ({ kind: "repo", repo }));
        return [...missing, ...present];
      }

      const sortedDocs = sortDocsReverseChronological(
        this.nodes.filter((n) => n.workspaceFolderName === element.folderName && n.type === element.type && !n.parentId)
      ).filter((node) => !this.filterText || this.isVisible(node));
      const expanded = this.expandedCategories.has(`${element.folderName}::${element.type}`);
      const visibleDocs = expanded ? sortedDocs : sortedDocs.slice(0, MAX_VISIBLE_DOCS_PER_CATEGORY);
      const docs: TreeItemData[] = visibleDocs.map((node) => ({ kind: "doc", node }));
      const more: TreeItemData[] =
        !expanded && sortedDocs.length > MAX_VISIBLE_DOCS_PER_CATEGORY
          ? [
              {
                kind: "more" as const,
                folderName: element.folderName,
                type: element.type,
                remaining: sortedDocs.length - MAX_VISIBLE_DOCS_PER_CATEGORY,
              },
            ]
          : [];
      const missing: TreeItemData[] = this.filterText
        ? []
        : this.missing
            .filter((p) => p.workspaceFolderName === element.folderName && p.docType === element.type)
            .map((problem) => ({ kind: "missing", problem }));
      return [...missing, ...docs, ...more];
    }

    if (element.kind === "doc") {
      return this.childrenOf(element.node).map((node) => ({ kind: "doc", node }));
    }

    return [];
  }
}

