import * as assert from "node:assert/strict";
import { computeGitignoreAdditions, computeGitignoreRemovals } from "../git/repoMigration";
import { withSpecmeshExclude } from "../crawler/crawler";

suite("withSpecmeshExclude", () => {
  test("adds .specmesh/** when there's no existing exclude list", () => {
    assert.deepEqual(withSpecmeshExclude(undefined), [".specmesh/**"]);
  });

  test("merges without duplicating an existing entry", () => {
    assert.deepEqual(withSpecmeshExclude([".specmesh/**", "docs/templates/**"]), [
      ".specmesh/**",
      "docs/templates/**",
    ]);
  });

  test("appends to existing custom excludes", () => {
    assert.deepEqual(withSpecmeshExclude(["docs/templates/**"]), ["docs/templates/**", ".specmesh/**"]);
  });
});

suite("computeGitignoreAdditions", () => {
  test("returns all lines when .gitignore is empty", () => {
    assert.deepEqual(computeGitignoreAdditions("", ["docs/adr/ADR-001.md", "docs/charter.md"]), [
      "docs/adr/ADR-001.md",
      "docs/charter.md",
    ]);
  });

  test("skips lines already present", () => {
    assert.deepEqual(
      computeGitignoreAdditions("node_modules/\ndocs/adr/ADR-001.md\n", ["docs/adr/ADR-001.md", "docs/charter.md"]),
      ["docs/charter.md"]
    );
  });
});

suite("computeGitignoreRemovals", () => {
  test("drops only the matching lines", () => {
    assert.equal(
      computeGitignoreRemovals("node_modules/\ndocs/adr/ADR-001.md\ndocs/charter.md\n", ["docs/adr/ADR-001.md"]),
      "node_modules/\ndocs/charter.md\n"
    );
  });

  test("no-ops when nothing matches", () => {
    assert.equal(computeGitignoreRemovals("node_modules/\n", ["docs/charter.md"]), "node_modules/\n");
  });
});
