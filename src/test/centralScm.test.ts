import * as assert from "node:assert/strict";
import {
  computeChangeGroups,
  parseBranchList,
  parseCheckoutConflictFiles,
  parseLsFilesStage,
  parseLsTree,
  parseRemoteList,
  parseUpstream,
} from "../git/centralScm";

suite("parseLsTree", () => {
  test("parses mode/type/sha/path lines into a path -> sha map", () => {
    const output = [
      "100644 blob aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tdocs/charter.md",
      "100644 blob bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tdocs/adr/ADR-001.md",
    ].join("\n");
    const result = parseLsTree(output);
    assert.equal(result.size, 2);
    assert.equal(result.get("docs/charter.md"), "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    assert.equal(result.get("docs/adr/ADR-001.md"), "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });

  test("returns an empty map for blank output", () => {
    assert.equal(parseLsTree("").size, 0);
    assert.equal(parseLsTree("\n\n").size, 0);
  });

  test("skips a malformed line missing a tab separator", () => {
    assert.equal(parseLsTree("not a valid ls-tree line").size, 0);
  });
});

suite("parseLsFilesStage", () => {
  test("parses mode/sha/stage/path lines into a path -> sha map", () => {
    const output = [
      "100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tdocs/charter.md",
      "100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tdocs/adr/ADR-001.md",
    ].join("\n");
    const result = parseLsFilesStage(output);
    assert.equal(result.size, 2);
    assert.equal(result.get("docs/charter.md"), "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    assert.equal(result.get("docs/adr/ADR-001.md"), "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });

  test("returns an empty map for blank output", () => {
    assert.equal(parseLsFilesStage("").size, 0);
  });
});

suite("computeChangeGroups", () => {
  test("a path identical across HEAD, index, and disk appears in neither group", () => {
    const head = new Map([["docs/charter.md", "aaa"]]);
    const index = new Map([["docs/charter.md", "aaa"]]);
    const disk = new Map([["docs/charter.md", "aaa"]]);
    assert.deepEqual(computeChangeGroups(head, index, disk, head.keys()), { staged: [], changes: [] });
  });

  test("a staged-only edit (index differs from HEAD, disk matches index) is staged, not changed", () => {
    const head = new Map([["docs/charter.md", "aaa"]]);
    const index = new Map([["docs/charter.md", "bbb"]]);
    const disk = new Map([["docs/charter.md", "bbb"]]);
    assert.deepEqual(computeChangeGroups(head, index, disk, ["docs/charter.md"]), {
      staged: ["docs/charter.md"],
      changes: [],
    });
  });

  test("an unstaged edit (disk differs from index, index matches HEAD) is a change, not staged", () => {
    const head = new Map([["docs/charter.md", "aaa"]]);
    const index = new Map([["docs/charter.md", "aaa"]]);
    const disk = new Map([["docs/charter.md", "ccc"]]);
    assert.deepEqual(computeChangeGroups(head, index, disk, ["docs/charter.md"]), {
      staged: [],
      changes: ["docs/charter.md"],
    });
  });

  test("a path can be both staged and changed at once", () => {
    const head = new Map([["docs/charter.md", "aaa"]]);
    const index = new Map([["docs/charter.md", "bbb"]]);
    const disk = new Map([["docs/charter.md", "ccc"]]);
    assert.deepEqual(computeChangeGroups(head, index, disk, ["docs/charter.md"]), {
      staged: ["docs/charter.md"],
      changes: ["docs/charter.md"],
    });
  });

  test("a never-committed, never-staged file on disk is a change only", () => {
    const head = new Map<string, string>();
    const index = new Map<string, string>();
    const disk = new Map([["docs/new.md", "ddd"]]);
    assert.deepEqual(computeChangeGroups(head, index, disk, ["docs/new.md"]), {
      staged: [],
      changes: ["docs/new.md"],
    });
  });
});

suite("parseBranchList", () => {
  test("marks the current branch from its leading '*'", () => {
    const result = parseBranchList("* main\n  feature-x\n");
    assert.deepEqual(result, [
      { name: "main", current: true },
      { name: "feature-x", current: false },
    ]);
  });

  test("returns an empty list for blank output", () => {
    assert.deepEqual(parseBranchList(""), []);
  });
});

suite("parseCheckoutConflictFiles", () => {
  test("extracts the listed files from git's overwrite-conflict error", () => {
    const stderr = [
      "error: Your local changes to the following files would be overwritten by checkout:",
      "\tdocs/charter.md",
      "Please commit your changes or stash them before you switch branches.",
      "Aborting",
    ].join("\n");
    assert.deepEqual(parseCheckoutConflictFiles(stderr), ["docs/charter.md"]);
  });

  test("returns an empty list for an unrelated error", () => {
    assert.deepEqual(parseCheckoutConflictFiles("fatal: not a git repository"), []);
  });
});

suite("parseRemoteList", () => {
  test("dedupes a remote's fetch/push line pair, keeping the fetch URL", () => {
    const output = [
      "origin\tgit@github.com:me/repo.git (fetch)",
      "origin\tgit@github.com:me/repo.git (push)",
    ].join("\n");
    assert.deepEqual(parseRemoteList(output), [{ name: "origin", url: "git@github.com:me/repo.git" }]);
  });

  test("parses multiple distinct remotes", () => {
    const output = [
      "origin\tgit@github.com:me/repo.git (fetch)",
      "origin\tgit@github.com:me/repo.git (push)",
      "backup\thttps://example.com/repo.git (fetch)",
      "backup\thttps://example.com/repo.git (push)",
    ].join("\n");
    assert.deepEqual(parseRemoteList(output), [
      { name: "origin", url: "git@github.com:me/repo.git" },
      { name: "backup", url: "https://example.com/repo.git" },
    ]);
  });

  test("returns an empty list for blank output", () => {
    assert.deepEqual(parseRemoteList(""), []);
  });
});

suite("parseUpstream", () => {
  test("splits '<remote>/<branch>' into its parts", () => {
    assert.deepEqual(parseUpstream("origin/main"), { remote: "origin", branch: "main" });
  });

  test("handles a branch name that itself contains a slash", () => {
    assert.deepEqual(parseUpstream("origin/feature/x"), { remote: "origin", branch: "feature/x" });
  });

  test("returns undefined for blank output (no upstream configured)", () => {
    assert.equal(parseUpstream(""), undefined);
    assert.equal(parseUpstream("\n"), undefined);
  });
});

