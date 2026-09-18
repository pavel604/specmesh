import { DocNode, DocTypeDefinition } from "../model/types";

/** Depth-first walk of a `track:` list including all nested `children`, for callers that need every
 * declared type regardless of nesting (file discovery, the "Add new doc" picker). */
export function flattenDocTypes(defs: DocTypeDefinition[]): DocTypeDefinition[] {
  const flat: DocTypeDefinition[] = [];
  for (const def of defs) {
    flat.push(def);
    if (def.children && def.children.length > 0) {
      flat.push(...flattenDocTypes(def.children));
    }
  }
  return flat;
}

/** Maps a child type's `type` to its declared parent's `type`, walking the whole tree. */
export function buildParentTypeMap(defs: DocTypeDefinition[]): Map<string, string> {
  const parentOf = new Map<string, string>();
  for (const def of defs) {
    for (const child of def.children ?? []) {
      parentOf.set(child.type, def.type);
    }
    if (def.children && def.children.length > 0) {
      for (const [childType, parentType] of buildParentTypeMap(def.children)) {
        parentOf.set(childType, parentType);
      }
    }
  }
  return parentOf;
}

/** Flattens `defs` and returns any `type` value that appears more than once (first occurrence wins
 * elsewhere; this just reports which ones a caller should drop). */
export function findDuplicateTypes(defs: DocTypeDefinition[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const def of flattenDocTypes(defs)) {
    if (seen.has(def.type)) {
      duplicates.add(def.type);
    } else {
      seen.add(def.type);
    }
  }
  return [...duplicates];
}

/** Maps each type that declares `children` to the ordered list of those children's `type` values, walking
 * the whole tree (so a nested `children`'s own `children` get an entry too). */
export function buildChildTypeOrder(defs: DocTypeDefinition[]): Map<string, string[]> {
  const order = new Map<string, string[]>();
  for (const def of defs) {
    if (def.children && def.children.length > 0) {
      order.set(
        def.type,
        def.children.map((c) => c.type)
      );
      for (const [type, childTypes] of buildChildTypeOrder(def.children)) {
        order.set(type, childTypes);
      }
    }
  }
  return order;
}

const VERSION_TOKEN_RE = /\.v(\d+)\.[^./]+$/;

function versionToken(relativePath: string): string | undefined {
  const fileName = relativePath.split("/").pop() ?? relativePath;
  return fileName.match(VERSION_TOKEN_RE)?.[1];
}

// the two front-matter keys this convention uses for a doc's creation date -- FR/epic docs use "Created",
// ADRs use "Date". Checked in this order so a doc with both (shouldn't normally happen) prefers "Created".
const DATE_METADATA_KEYS = ["Created", "Date"];

function docTimestamp(node: DocNode): number | undefined {
  for (const key of DATE_METADATA_KEYS) {
    const raw = node.metadata[key];
    if (!raw) {
      continue;
    }
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

/** Newest first, so a category's list leads with recent work instead of its first-ever file. Sorts by
 * parsed `Created`/`Date` front-matter when present; falls back to reverse title order otherwise (still
 * newest-first for sequentially-numbered types like ADR-* and FR-* that don't declare a date). */
export function sortDocsReverseChronological(nodes: DocNode[]): DocNode[] {
  return [...nodes].sort((a, b) => {
    const tsA = docTimestamp(a);
    const tsB = docTimestamp(b);
    if (tsA !== undefined && tsB !== undefined && tsA !== tsB) {
      return tsB - tsA;
    }
    if (tsA !== undefined && tsB === undefined) {
      return -1;
    }
    if (tsB !== undefined && tsA === undefined) {
      return 1;
    }
    return b.title.localeCompare(a.title);
  });
}

function directoryOf(relativePath: string): string {
  const idx = relativePath.lastIndexOf("/");
  return idx === -1 ? "" : relativePath.slice(0, idx);
}

/** Matches each child-type doc instance to the specific parent-type instance sharing its directory and
 * version token (e.g. `plan.v2.md` -> `spec.v2.md` in the same FR folder), setting `parentId` on a match.
 * A child with no version token, or no sibling of the parent type sharing its directory+version, is left
 * unmatched -- still rendered under its own top-level category, just not nested (see FR-013). */
export function attachParentIds(nodes: DocNode[], defs: DocTypeDefinition[]): DocNode[] {
  const parentTypeOf = buildParentTypeMap(defs);
  if (parentTypeOf.size === 0) {
    return nodes;
  }

  return nodes.map((node) => {
    const parentType = parentTypeOf.get(node.type);
    const version = parentType ? versionToken(node.relativePath) : undefined;
    if (!parentType || !version) {
      return node;
    }
    const dir = directoryOf(node.relativePath);
    const parent = nodes.find(
      (candidate) =>
        candidate.type === parentType &&
        candidate.workspaceFolderName === node.workspaceFolderName &&
        directoryOf(candidate.relativePath) === dir &&
        versionToken(candidate.relativePath) === version
    );
    return parent ? { ...node, parentId: parent.id } : node;
  });
}
