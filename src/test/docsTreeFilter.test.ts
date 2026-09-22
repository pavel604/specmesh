import * as assert from "node:assert/strict";
import { DocsTreeProvider, docMatchesFilter } from "../views/docsTreeProvider";
import { DocNode } from "../model/types";

function makeNode(overrides: Partial<DocNode> & Pick<DocNode, "id" | "type" | "title" | "relativePath">): DocNode {
  return {
    categoryLabel: "ADRs",
    absolutePath: `/repo/${overrides.relativePath}`,
    workspaceFolderName: "specmesh",
    workspaceFolderPath: "/repo",
    metadata: {},
    links: [],
    ...overrides,
  };
}

suite("docMatchesFilter", () => {
  test("matches a title substring case-insensitively", () => {
    assert.equal(docMatchesFilter("Docs Tree Search Filter", "spec.v1.md", "", "search"), true);
  });

  test("matches a filename substring case-insensitively", () => {
    assert.equal(docMatchesFilter("Some Title", "ADR-005-search.md", "", "SEARCH"), true);
  });

  test("matches a body content substring case-insensitively", () => {
    assert.equal(docMatchesFilter("Some Title", "file.md", "...uses a Builder pattern...", "builder"), true);
  });

  test("does not match unrelated text", () => {
    assert.equal(docMatchesFilter("Some Title", "ADR-005-search.md", "nothing relevant here", "unrelated"), false);
  });

  test("matches everything when the filter text is empty", () => {
    assert.equal(docMatchesFilter("Some Title", "file.md", "", ""), true);
  });
});

suite("DocsTreeProvider filtering", () => {
  test("hides non-matching docs/categories/config but keeps a matching doc's children visible", () => {
    const spec = makeNode({
      id: "specmesh::docs/FR-017/spec.v1.md",
      type: "fr-spec",
      categoryLabel: "FR Specs",
      title: "FR-017: Docs Tree Search Filter",
      relativePath: "docs/FR-017/spec.v1.md",
    });
    const plan = makeNode({
      id: "specmesh::docs/FR-017/plan.v1.md",
      type: "fr-plan",
      categoryLabel: "FR Plans",
      title: "Implementation Plan: FR-017",
      relativePath: "docs/FR-017/plan.v1.md",
      parentId: spec.id,
    });
    const unrelated = makeNode({
      id: "specmesh::docs/adr/ADR-001-testing-strategy.md",
      type: "adr",
      title: "ADR-001: Testing Strategy",
      relativePath: "docs/adr/ADR-001-testing-strategy.md",
    });

    const provider = new DocsTreeProvider();
    provider.update([spec, plan, unrelated], [], new Map(), new Map(), []);
    provider.setFilter("search filter");

    const folders = provider.getChildren();
    assert.equal(folders.length, 1);
    const folderItem = folders[0];
    if (folderItem.kind !== "folder") {
      throw new Error("expected a folder item");
    }

    const folderChildren = provider.getChildren(folderItem);
    assert.equal(
      folderChildren.some((c) => c.kind === "config"),
      false,
      "config entry should be hidden while filtering"
    );
    const categories = folderChildren.filter((c) => c.kind === "category");
    assert.deepEqual(
      categories.map((c) => (c.kind === "category" ? c.type : undefined)),
      ["fr-spec"]
    );

    const docItems = provider.getChildren(categories[0]);
    assert.equal(docItems.length, 1);
    const docItem = docItems[0];
    if (docItem.kind !== "doc") {
      throw new Error("expected a doc item");
    }
    assert.equal(docItem.node.id, spec.id);

    const specChildren = provider.getChildren(docItem);
    assert.equal(specChildren.length, 1);
    const childItem = specChildren[0];
    assert.ok(childItem.kind === "doc" && childItem.node.id === plan.id);
  });

  test("clearing the filter restores the full tree", () => {
    const node = makeNode({
      id: "specmesh::docs/adr/ADR-001-testing-strategy.md",
      type: "adr",
      title: "ADR-001: Testing Strategy",
      relativePath: "docs/adr/ADR-001-testing-strategy.md",
    });
    const provider = new DocsTreeProvider();
    provider.update([node], [], new Map(), new Map(), []);

    provider.setFilter("no-match-at-all");
    assert.equal(provider.getChildren().length, 0);

    provider.setFilter("");
    assert.equal(provider.getFilter(), "");
    assert.equal(provider.getChildren().length, 1);
  });

  test("matches a doc whose body content (not title/filename) contains the filter text", () => {
    const node = makeNode({
      id: "specmesh::docs/adr/ADR-002-something.md",
      type: "adr",
      title: "ADR-002: Something Else",
      relativePath: "docs/adr/ADR-002-something.md",
      content: "# ADR-002\n\nWe use a Builder pattern here.",
    });
    const provider = new DocsTreeProvider();
    provider.update([node], [], new Map(), new Map(), []);

    provider.setFilter("builder");

    const folderChildren = provider.getChildren(provider.getChildren()[0]);
    const category = folderChildren.find((c) => c.kind === "category");
    assert.ok(category, "expected the doc's category to be visible via content match");
    const docItems = provider.getChildren(category);
    assert.equal(docItems.length, 1);
  });
});

suite("DocsTreeProvider.visibleDocCount", () => {
  test("returns the total doc count when no filter is active", () => {
    const a = makeNode({ id: "a", type: "adr", title: "Alpha", relativePath: "docs/adr/a.md" });
    const b = makeNode({ id: "b", type: "adr", title: "Beta", relativePath: "docs/adr/b.md" });
    const provider = new DocsTreeProvider();
    provider.update([a, b], [], new Map(), new Map(), []);
    assert.equal(provider.visibleDocCount(), 2);
  });

  test("counts a matching parent plus all of its unconditionally-rendered children", () => {
    const spec = makeNode({
      id: "spec",
      type: "fr-spec",
      title: "FR-017: Docs Tree Search Filter",
      relativePath: "docs/FR-017/spec.v1.md",
    });
    const plan = makeNode({
      id: "plan",
      type: "fr-plan",
      title: "Implementation Plan: FR-017",
      relativePath: "docs/FR-017/plan.v1.md",
      parentId: spec.id,
    });
    const unrelated = makeNode({ id: "unrelated", type: "adr", title: "ADR-001", relativePath: "docs/adr/x.md" });

    const provider = new DocsTreeProvider();
    provider.update([spec, plan, unrelated], [], new Map(), new Map(), []);
    provider.setFilter("search filter");

    assert.equal(provider.visibleDocCount(), 2);
  });
});
