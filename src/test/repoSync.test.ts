import * as assert from "node:assert/strict";
import { diffDeclaredRepos, pickMirroredRemoteUrl } from "../git/repoSync";
import { DeclaredRepo } from "../model/types";

function repo(overrides: Partial<DeclaredRepo> & Pick<DeclaredRepo, "name" | "path">): DeclaredRepo {
  return {
    remote: "git@github.com:pavel604/example.git",
    workspaceFolderName: "root",
    present: false,
    ...overrides,
  };
}

suite("diffDeclaredRepos", () => {
  test("one repo added (missing on disk)", () => {
    const previous: DeclaredRepo[] = [];
    const current = [repo({ name: "Web", path: "./web", present: false })];

    assert.deepEqual(diffDeclaredRepos(previous, current), { added: current, removed: [] });
  });

  test("one repo added that's already present on disk is not reported as added", () => {
    const previous: DeclaredRepo[] = [];
    const current = [repo({ name: "Web", path: "./web", present: true })];

    assert.deepEqual(diffDeclaredRepos(previous, current), { added: [], removed: [] });
  });

  test("multiple repos added in one save, in declaration order", () => {
    const previous: DeclaredRepo[] = [];
    const current = [
      repo({ name: "Web", path: "./web", present: false }),
      repo({ name: "Api", path: "./api", present: false }),
    ];

    assert.deepEqual(diffDeclaredRepos(previous, current), { added: current, removed: [] });
  });

  test("one repo removed whose folder still exists", () => {
    const previous = [repo({ name: "Web", path: "./web", present: true })];
    const current: DeclaredRepo[] = [];

    assert.deepEqual(diffDeclaredRepos(previous, current), { added: [], removed: previous });
  });

  test("one repo removed whose folder no longer exists is not reported as removed", () => {
    const previous = [repo({ name: "Web", path: "./web", present: false })];
    const current: DeclaredRepo[] = [];

    assert.deepEqual(diffDeclaredRepos(previous, current), { added: [], removed: [] });
  });

  test("multiple repos removed in one save, in declaration order", () => {
    const previous = [
      repo({ name: "Web", path: "./web", present: true }),
      repo({ name: "Api", path: "./api", present: true }),
    ];
    const current: DeclaredRepo[] = [];

    assert.deepEqual(diffDeclaredRepos(previous, current), { added: [], removed: previous });
  });

  test("mixed batch: added entries with some already present, removed entries with some already gone from disk", () => {
    const previous = [
      repo({ name: "Web", path: "./web", present: true }), // stays declared, untouched below
      repo({ name: "Api", path: "./api", present: true }), // removed, folder still exists -> reported
      repo({ name: "Old", path: "./old", present: false }), // removed, folder already gone -> not reported
    ];
    const current = [
      repo({ name: "Web", path: "./web", present: true }), // unchanged
      repo({ name: "Docs", path: "./docs", present: false }), // new, missing -> reported
      repo({ name: "Cli", path: "./cli", present: true }), // new, already on disk -> not reported
    ];

    assert.deepEqual(diffDeclaredRepos(previous, current), {
      added: [current[1]],
      removed: [previous[1]],
    });
  });

  test("no changes yields empty diff", () => {
    const repos = [repo({ name: "Web", path: "./web", present: true })];

    assert.deepEqual(diffDeclaredRepos(repos, repos), { added: [], removed: [] });
  });
});

suite("pickMirroredRemoteUrl", () => {
  test("clears when there are no remotes", () => {
    assert.deepEqual(pickMirroredRemoteUrl([]), { kind: "clear" });
  });

  test("mirrors the sole remote's URL", () => {
    assert.deepEqual(pickMirroredRemoteUrl([{ name: "origin", url: "git@github.com:pavel604/specmesh.git" }]), {
      kind: "set",
      url: "git@github.com:pavel604/specmesh.git",
    });
  });

  test("skips when there are 2+ remotes (ambiguous which is canonical)", () => {
    assert.deepEqual(
      pickMirroredRemoteUrl([
        { name: "origin", url: "git@github.com:pavel604/specmesh.git" },
        { name: "fork", url: "git@github.com:someoneelse/specmesh.git" },
      ]),
      { kind: "skip" }
    );
  });
});
