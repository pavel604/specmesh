import { DocNode } from "../model/types";

export interface GraphNode {
  id: string;
  title: string;
  relativePath: string;
  fileName: string;
  workspaceFolderName: string;
  type: string;
  absolutePath: string;
  /** true when this node has no resolved link and no docType nesting relationship in or out (independent
   * of the doc's `root` flag) */
  stray: boolean;
  x: number;
  y: number;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  /** "link" for a resolved markdown link, "nesting" for a docType parent/child relationship (e.g. an FR
   * spec and its plan/tasks/walkthrough) that isn't necessarily hyperlinked between the two docs. */
  kind: "link" | "nesting";
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// deterministic layout constants: each connected component is drawn as a top-down tree (BFS spanning tree
// from a chosen root, subtree-width placement so sibling branches never overlap); components are tiled
// left-to-right; strays get their own grid below every component so they read as visually separated.
const H_SPACING = 70;
const V_SPACING = 100;
const COMPONENT_GAP = H_SPACING * 2;
const STRAY_SPACING = 90;
const STRAYS_PER_ROW = 8;

/** Builds the graph's nodes/edges/layout from crawled docs: an edge is drawn for every resolved (existing)
 * link from one tracked doc to another, and for every docType parent/child nesting relationship (e.g. an FR
 * spec and its plan/tasks/walkthrough); a node with neither kind of relationship in or out is a "stray" and
 * laid out separately from the connected components. */
export function buildGraphModel(nodes: DocNode[]): GraphModel {
  const byAbsolutePath = new Map(nodes.map((n) => [n.absolutePath, n]));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const adjacency = new Map<string, Set<string>>();
  const outDegree = new Map<string, number>();
  const edges: GraphEdge[] = [];
  const seenDirectedEdges = new Set<string>();
  const linkedInOrOut = new Set<string>();

  const connect = (sourceId: string, targetId: string, kind: "link" | "nesting"): void => {
    linkedInOrOut.add(sourceId);
    linkedInOrOut.add(targetId);

    if (!adjacency.has(sourceId)) {
      adjacency.set(sourceId, new Set());
    }
    if (!adjacency.has(targetId)) {
      adjacency.set(targetId, new Set());
    }
    adjacency.get(sourceId)!.add(targetId);
    adjacency.get(targetId)!.add(sourceId);

    const directedKey = `${kind}:${sourceId}->${targetId}`;
    if (!seenDirectedEdges.has(directedKey)) {
      seenDirectedEdges.add(directedKey);
      edges.push({ sourceId, targetId, kind });
      outDegree.set(sourceId, (outDegree.get(sourceId) ?? 0) + 1);
    }
  };

  for (const node of nodes) {
    for (const link of node.links) {
      if (!link.exists || !link.resolvedAbsolutePath) {
        continue;
      }
      const target = byAbsolutePath.get(link.resolvedAbsolutePath);
      if (!target || target.id === node.id) {
        continue;
      }
      connect(node.id, target.id, "link");
    }
  }

  for (const node of nodes) {
    if (!node.parentId || !byId.has(node.parentId)) {
      continue;
    }
    connect(node.parentId, node.id, "nesting");
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const node of nodes) {
    if (!linkedInOrOut.has(node.id) || visited.has(node.id)) {
      continue;
    }
    const queue = [node.id];
    visited.add(node.id);
    const component: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  const strayIds = nodes.filter((n) => !linkedInOrOut.has(n.id)).map((n) => n.id);

  const positions = new Map<string, { x: number; y: number }>();
  let nextComponentX = 0;
  for (const component of components) {
    nextComponentX = layoutComponentAsTree(component, adjacency, outDegree, nextComponentX, positions) + COMPONENT_GAP;
  }

  const strayRowY = (components.length > 0 ? Math.max(...[...positions.values()].map((p) => p.y)) : 0) + V_SPACING * 1.5;
  strayIds.forEach((id, i) => {
    const col = i % STRAYS_PER_ROW;
    const row = Math.floor(i / STRAYS_PER_ROW);
    positions.set(id, { x: (col + 1) * STRAY_SPACING, y: strayRowY + row * STRAY_SPACING });
  });

  const graphNodes: GraphNode[] = nodes.map((n) => {
    const pos = positions.get(n.id) ?? { x: 0, y: 0 };
    return {
      id: n.id,
      title: n.title,
      relativePath: n.relativePath,
      fileName: n.relativePath.split("/").pop() ?? n.relativePath,
      workspaceFolderName: n.workspaceFolderName,
      type: n.type,
      absolutePath: n.absolutePath,
      stray: !linkedInOrOut.has(n.id),
      x: pos.x,
      y: pos.y,
    };
  });

  return { nodes: graphNodes, edges };
}

/** Lays out one connected component as a top-down tree: picks the node with the highest out-degree as root
 * (ties broken by the component's original node order), builds a BFS spanning tree over the (undirected)
 * adjacency for depth/parent-child structure, then assigns each leaf the next free horizontal slot and each
 * parent the midpoint of its children's x — guaranteeing sibling branches never overlap. Returns the x
 * coordinate just past this component's rightmost slot, so the caller can tile the next component after it. */
function layoutComponentAsTree(
  component: string[],
  adjacency: Map<string, Set<string>>,
  outDegree: Map<string, number>,
  startX: number,
  positions: Map<string, { x: number; y: number }>
): number {
  const componentSet = new Set(component);
  let root = component[0];
  let bestOutDegree = outDegree.get(root) ?? 0;
  for (const id of component) {
    const degree = outDegree.get(id) ?? 0;
    if (degree > bestOutDegree) {
      root = id;
      bestOutDegree = degree;
    }
  }

  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const depthOf = new Map<string, number>();
  const visited = new Set<string>([root]);
  depthOf.set(root, 0);
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!componentSet.has(neighbor) || visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      parentOf.set(neighbor, current);
      depthOf.set(neighbor, (depthOf.get(current) ?? 0) + 1);
      if (!childrenOf.has(current)) {
        childrenOf.set(current, []);
      }
      childrenOf.get(current)!.push(neighbor);
      queue.push(neighbor);
    }
  }

  let nextSlot = 0;
  const assignX = (id: string): number => {
    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) {
      const x = startX + nextSlot * H_SPACING;
      nextSlot += 1;
      positions.set(id, { x, y: (depthOf.get(id) ?? 0) * V_SPACING });
      return x;
    }
    const childXs = children.map(assignX);
    const x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    positions.set(id, { x, y: (depthOf.get(id) ?? 0) * V_SPACING });
    return x;
  };
  assignX(root);

  return startX + nextSlot * H_SPACING;
}
