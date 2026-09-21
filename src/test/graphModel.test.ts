import * as assert from "node:assert/strict";
import { buildGraphModel } from "../views/graphModel";
import { DocLink, DocNode } from "../model/types";

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

function makeLink(overrides: Partial<DocLink>): DocLink {
  return {
    text: "link",
    rawTarget: "./target.md",
    resolvedAbsolutePath: null,
    exists: false,
    lineIndex: 0,
    startCol: 0,
    endCol: 10,
    ...overrides,
  };
}

suite("buildGraphModel", () => {
  test("two linked docs form one component with an edge", () => {
    const a = makeNode({
      id: "repo::a.md",
      absolutePath: "/repo/a.md",
      links: [makeLink({ resolvedAbsolutePath: "/repo/b.md", exists: true })],
    });
    const b = makeNode({ id: "repo::b.md", absolutePath: "/repo/b.md" });

    const model = buildGraphModel([a, b]);

    assert.equal(model.edges.length, 1);
    assert.equal(model.edges[0].sourceId, a.id);
    assert.equal(model.edges[0].targetId, b.id);
    assert.equal(model.nodes.find((n) => n.id === a.id)?.stray, false);
    assert.equal(model.nodes.find((n) => n.id === b.id)?.stray, false);
  });

  test("a doc with no resolved links in or out is stray", () => {
    const node = makeNode({ id: "repo::solo.md", absolutePath: "/repo/solo.md" });

    const model = buildGraphModel([node]);

    assert.equal(model.nodes[0].stray, true);
    assert.equal(model.edges.length, 0);
  });

  test("a doc with only a broken link is still stray", () => {
    const node = makeNode({
      id: "repo::solo.md",
      absolutePath: "/repo/solo.md",
      links: [makeLink({ resolvedAbsolutePath: null, exists: false })],
    });

    const model = buildGraphModel([node]);

    assert.equal(model.nodes[0].stray, true);
    assert.equal(model.edges.length, 0);
  });

  test("transitively linked docs (A to B to C) share one component", () => {
    const a = makeNode({
      id: "repo::a.md",
      absolutePath: "/repo/a.md",
      links: [makeLink({ resolvedAbsolutePath: "/repo/b.md", exists: true })],
    });
    const b = makeNode({
      id: "repo::b.md",
      absolutePath: "/repo/b.md",
      links: [makeLink({ resolvedAbsolutePath: "/repo/c.md", exists: true })],
    });
    const c = makeNode({ id: "repo::c.md", absolutePath: "/repo/c.md" });

    const model = buildGraphModel([a, b, c]);

    assert.equal(model.nodes.every((n) => !n.stray), true);
    assert.equal(model.edges.length, 2);
  });

  test("a root doc that links out (but nothing links back) is not stray", () => {
    const root = makeNode({
      id: "repo::root.md",
      absolutePath: "/repo/root.md",
      root: true,
      links: [makeLink({ resolvedAbsolutePath: "/repo/child.md", exists: true })],
    });
    const child = makeNode({ id: "repo::child.md", absolutePath: "/repo/child.md" });

    const model = buildGraphModel([root, child]);

    assert.equal(model.nodes.find((n) => n.id === root.id)?.stray, false);
  });

  test("a parentId nesting relationship (no markdown link) forms an edge and is not stray", () => {
    const spec = makeNode({ id: "repo::spec.v1.md", absolutePath: "/repo/spec.v1.md" });
    const plan = makeNode({ id: "repo::plan.v1.md", absolutePath: "/repo/plan.v1.md", parentId: spec.id });

    const model = buildGraphModel([spec, plan]);

    assert.equal(model.edges.length, 1);
    assert.equal(model.edges[0].kind, "nesting");
    assert.equal(model.edges[0].sourceId, spec.id);
    assert.equal(model.edges[0].targetId, plan.id);
    assert.equal(model.nodes.every((n) => !n.stray), true);
  });
});
