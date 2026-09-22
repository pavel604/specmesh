export interface DocTypeDefinition {
  type: string;
  label: string;
  /** glob relative to a workspace folder root, e.g. "docs/adr/ADR-*.md". A literal (wildcard-free) glob is
   * treated as a specific expected file and flagged as "missing" if it doesn't exist. */
  glob: string;
  /** glob(s) relative to the workspace folder root to exclude from `glob`'s matches, e.g. a broad
   * ".github/**\/*.md" catch-all excluding ".github/skills/*\/templates/**". */
  exclude?: string[];
  /** when true, docs of this type are never flagged as orphans (e.g. charter/epic/instructions/skill docs
   * that are legitimate roots, not expected to be linked from elsewhere). Defaults to false/checked. */
  root?: boolean;
  /** nested doc type definitions rendered under a matched instance of this type in the tree, e.g. fr-spec's
   * children being fr-plan/fr-tasks/fr-walkthrough. A type may only be nested under one parent. */
  children?: DocTypeDefinition[];
}

export interface DocLink {
  text: string;
  rawTarget: string;
  resolvedAbsolutePath: string | null;
  exists: boolean;
  lineIndex: number;
  startCol: number;
  endCol: number;
}

export interface DocNode {
  /** stable id: "<workspaceFolderName>::<relativePath>" */
  id: string;
  type: string;
  /** the DocTypeDefinition's label, e.g. "ADRs" — used to group this node under a tree category */
  categoryLabel: string;
  title: string;
  absolutePath: string;
  workspaceFolderName: string;
  workspaceFolderPath: string;
  relativePath: string;
  metadata: Record<string, string>;
  links: DocLink[];
  /** raw file text as read at crawl time -- used for body-content search matching (FR-017 v2). */
  content?: string;
  /** copied from the originating DocTypeDefinition.root at crawl time. */
  root?: boolean;
  /** id of the matched parent DocNode (same directory + version token, per the parent type's `children`
   * declaration), when this doc nests under one in the tree. Undefined if unmatched or not a child type. */
  parentId?: string;
}

export interface Problem {
  kind: "broken-link" | "orphan" | "missing";
  docId: string;
  absolutePath: string;
  message: string;
  lineIndex?: number;
  startCol?: number;
  endCol?: number;
  /** set for "missing" problems, so the tree can group them under the right folder/category */
  workspaceFolderName?: string;
  docType?: string;
  categoryLabel?: string;
  expectedPath?: string;
}

export interface RepoManifestEntry {
  name: string;
  remote: string;
  /** relative to the folder containing the .specmesh.yml that declared it */
  path: string;
}

export interface DeclaredRepo extends RepoManifestEntry {
  workspaceFolderName: string;
  /** whether `path` currently exists on disk */
  present: boolean;
}
