import * as assert from "node:assert/strict";
import {
  findBrokenLinks,
  findMissingDocs,
  findOrphans,
  getDocLinks,
  listDocs,
  listRepos,
} from "../queries/docQueries";
import { DeclaredRepo, DocNode, Problem } from "../model/types";

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

function makeProblem(overrides: Partial<Problem> & Pick<Problem, "kind" | "docId">): Problem {
  return {
    absolutePath: "/repo/doc.md",
    message: "message",
    ...overrides,
  };
}

suite("listDocs", () => {
  const nodes = [
    makeNode({ id: "repo::adr/ADR-001.md", type: "adr", title: "ADR 1", relativePath: "adr/ADR-001.md" }),
    makeNode({
      id: "other::charter.md",
      workspaceFolderName: "other",
      type: "charter",
      title: "Charter",
      relativePath: "charter.md",
    }),
  ];

  test("returns every doc when no filters are given", () => {
    const result = listDocs(nodes, {});
    assert.match(result, /2 doc\(s\) found/);
    assert.match(result, /ADR 1/);
    assert.match(result, /Charter/);
  });

  test("filters by folder", () => {
    const result = listDocs(nodes, { folder: "other" });
    assert.match(result, /1 doc\(s\) found/);
    assert.match(result, /Charter/);
    assert.doesNotMatch(result, /ADR 1/);
  });

  test("filters by type", () => {
    const result = listDocs(nodes, { type: "adr" });
    assert.match(result, /1 doc\(s\) found/);
    assert.match(result, /ADR 1/);
  });

  test("filters by a query matched against title or relativePath", () => {
    const result = listDocs(nodes, { query: "charter" });
    assert.match(result, /1 doc\(s\) found/);
    assert.match(result, /Charter/);
  });

  test("returns a no-match message when nothing matches", () => {
    const result = listDocs(nodes, { query: "nonexistent" });
    assert.match(result, /No tracked docs matched/);
  });
});

suite("findBrokenLinks", () => {
  test("returns a no-broken-links message when there are none", () => {
    assert.match(findBrokenLinks([], undefined), /No broken links in the workspace/);
  });

  test("filters by folder and formats each match", () => {
    const problems = [
      makeProblem({ kind: "broken-link", docId: "repo::doc.md", message: "doc.md -> ./missing.md is broken" }),
      makeProblem({ kind: "broken-link", docId: "other::doc2.md", message: "doc2.md -> ./gone.md is broken" }),
      makeProblem({ kind: "orphan", docId: "repo::doc.md", message: "not a broken link" }),
    ];

    const result = findBrokenLinks(problems, "repo");

    assert.match(result, /1 broken link\(s\)/);
    assert.match(result, /doc\.md -> \.\/missing\.md is broken/);
    assert.doesNotMatch(result, /gone\.md/);
  });
});

suite("findOrphans", () => {
  test("returns a no-orphans message when there are none", () => {
    assert.match(findOrphans([], "repo"), /No orphaned docs in repo/);
  });

  test("filters to only orphan-kind problems", () => {
    const problems = [
      makeProblem({ kind: "orphan", docId: "repo::orphan.md", message: "orphan.md is unlinked" }),
      makeProblem({ kind: "broken-link", docId: "repo::doc.md", message: "not an orphan" }),
    ];

    const result = findOrphans(problems, undefined);

    assert.match(result, /1 orphaned doc\(s\)/);
    assert.match(result, /orphan\.md is unlinked/);
  });
});

suite("findMissingDocs", () => {
  test("returns a no-missing message when there are none", () => {
    assert.match(findMissingDocs([], undefined), /No missing tracked files in the workspace/);
  });

  test("filters by workspaceFolderName and formats category/expectedPath", () => {
    const problems = [
      makeProblem({
        kind: "missing",
        docId: "repo::missing:README.md",
        workspaceFolderName: "repo",
        categoryLabel: "Readme",
        expectedPath: "README.md",
      }),
      makeProblem({
        kind: "missing",
        docId: "other::missing:LICENSE",
        workspaceFolderName: "other",
        categoryLabel: "License",
        expectedPath: "LICENSE",
      }),
    ];

    const result = findMissingDocs(problems, "repo");

    assert.match(result, /1 missing tracked file\(s\)/);
    assert.match(result, /Readme: README\.md/);
    assert.doesNotMatch(result, /LICENSE/);
  });
});

suite("listRepos", () => {
  function makeRepo(overrides: Partial<DeclaredRepo>): DeclaredRepo {
    return {
      name: "Web",
      remote: "git@example.com:org/web.git",
      path: "web",
      workspaceFolderName: "repo",
      present: true,
      ...overrides,
    };
  }

  test("returns a no-repos message when there are none", () => {
    assert.match(listRepos([], undefined), /No repos declared in any workspace folder/);
  });

  test("filters by folder and flags a not-present repo", () => {
    const repos = [makeRepo({ present: false }), makeRepo({ workspaceFolderName: "other", name: "Api" })];

    const result = listRepos(repos, "repo");

    assert.match(result, /1 declared repo\(s\)/);
    assert.match(result, /NOT PRESENT/);
    assert.doesNotMatch(result, /Api/);
  });
});

suite("getDocLinks", () => {
  test("reports no match when the target path doesn't match any tracked doc", () => {
    const result = getDocLinks([], "docs/missing.md");
    assert.match(result, /No tracked doc matched/);
  });

  test("reports ambiguity when multiple docs match by suffix", () => {
    const nodes = [
      makeNode({ id: "a::x/README.md", relativePath: "x/README.md" }),
      makeNode({ id: "b::y/README.md", relativePath: "y/README.md", workspaceFolderName: "b" }),
    ];

    const result = getDocLinks(nodes, "README.md");

    assert.match(result, /Multiple docs matched/);
  });

  test("lists outgoing links for a single matched doc", () => {
    const nodes = [
      makeNode({
        id: "repo::doc.md",
        relativePath: "doc.md",
        links: [
          { text: "ok", rawTarget: "./ok.md", resolvedAbsolutePath: "/repo/ok.md", exists: true, lineIndex: 0, startCol: 0, endCol: 5 },
          { text: "bad", rawTarget: "./bad.md", resolvedAbsolutePath: null, exists: false, lineIndex: 1, startCol: 0, endCol: 5 },
        ],
      }),
    ];

    const result = getDocLinks(nodes, "doc.md");

    assert.match(result, /doc\.md \(repo\) links to/);
    assert.match(result, /"ok" -> \.\/ok\.md \[resolves\]/);
    assert.match(result, /"bad" -> \.\/bad\.md \[BROKEN\]/);
  });

  test("reports no outgoing links for a doc with none", () => {
    const nodes = [makeNode({ id: "repo::doc.md", relativePath: "doc.md", links: [] })];

    const result = getDocLinks(nodes, "doc.md");

    assert.match(result, /has no outgoing markdown links/);
  });
});
