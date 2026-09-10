import { DocNode, Problem } from "../model/types";

// Docs expected to be referenced from somewhere else in the graph (an epic, another
// spec, etc). Mission/epic docs are legitimate roots, so they're excluded here.
const ORPHAN_CHECK_TYPES = new Set(["adr", "reference", "fr-spec"]);

export function computeProblems(nodes: DocNode[]): Problem[] {
  const problems: Problem[] = [];
  const linkedAbsolutePaths = new Set<string>();

  for (const node of nodes) {
    for (const link of node.links) {
      if (!link.exists) {
        problems.push({
          kind: "broken-link",
          docId: node.id,
          absolutePath: node.absolutePath,
          message: `Broken link "${link.rawTarget}" in ${node.relativePath}`,
          lineIndex: link.lineIndex,
          startCol: link.startCol,
          endCol: link.endCol,
        });
      } else if (link.resolvedAbsolutePath) {
        linkedAbsolutePaths.add(link.resolvedAbsolutePath);
      }
    }
  }

  for (const node of nodes) {
    if (ORPHAN_CHECK_TYPES.has(node.type) && !linkedAbsolutePaths.has(node.absolutePath)) {
      problems.push({
        kind: "orphan",
        docId: node.id,
        absolutePath: node.absolutePath,
        message: `${node.relativePath} is not linked from any other tracked doc`,
      });
    }
  }

  return problems;
}
