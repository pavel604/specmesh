export interface DocTypeDefinition {
  type: string;
  label: string;
  /** glob relative to a workspace folder root, e.g. "docs/adr/ADR-*.md". A literal (wildcard-free) glob is
   * treated as a specific expected file and flagged as "missing" if it doesn't exist. */
  glob: string;
  /** glob(s) relative to the workspace folder root to exclude from `glob`'s matches, e.g. a broad
   * ".github/**\/*.md" catch-all excluding ".github/skills/*\/templates/**". */
  exclude?: string[];
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
