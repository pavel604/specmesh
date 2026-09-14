import * as assert from "node:assert/strict";
import { computeProblems } from "../crawler/graph";
import { DocNode } from "../model/types";

function makeNode(overrides: Partial<DocNode>): DocNode {
  return {
    id: "repo::doc.md",
    type: "adr",
    categoryLabel: "ADRs",
    title: "Doc",
    absolutePath: "/repo/doc.md",
    workspaceFolderName: "repo",
    workspaceFolderPath: "/repo",
    relativePath: "doc.md",
    metadata: {},
    links: [],
    ...overrides,
  };
}

suite("computeProblems", () => {
  test("flags a broken link", () => {
    const node = makeNode({
      root: true,
      links: [
        {
          text: "missing",
          rawTarget: "./missing.md",
          resolvedAbsolutePath: null,
          exists: false,
          lineIndex: 0,
          startCol: 0,
          endCol: 10,
        },
      ],
    });

    const problems = computeProblems([node]);

    assert.equal(problems.length, 1);
    assert.equal(problems[0].kind, "broken-link");
    assert.equal(problems[0].docId, node.id);
  });

  test("flags a non-root doc that nothing links to as an orphan", () => {
    const node = makeNode({ id: "repo::orphan.md", absolutePath: "/repo/orphan.md" });

    const problems = computeProblems([node]);

    assert.equal(problems.length, 1);
    assert.equal(problems[0].kind, "orphan");
  });

  test("does not flag a root doc as an orphan even when unlinked", () => {
    const node = makeNode({ root: true });

    const problems = computeProblems([node]);

    assert.equal(problems.length, 0);
  });

  test("does not flag a doc that is linked from another node", () => {
    const target = makeNode({ id: "repo::target.md", absolutePath: "/repo/target.md" });
    const source = makeNode({
      id: "repo::source.md",
      absolutePath: "/repo/source.md",
      root: true,
      links: [
        {
          text: "target",
          rawTarget: "./target.md",
          resolvedAbsolutePath: "/repo/target.md",
          exists: true,
          lineIndex: 0,
          startCol: 0,
          endCol: 10,
        },
      ],
    });

    const problems = computeProblems([source, target]);

    assert.equal(problems.length, 0);
  });
});
