import * as assert from "node:assert/strict";
import { parseLsTree, isPendingSync, classifySyncStatus } from "../git/centralScm";

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

suite("isPendingSync", () => {
  test("is false when the on-disk hash matches the committed hash", () => {
    assert.equal(isPendingSync("abc123", "abc123"), false);
  });

  test("is true when the on-disk hash differs from the committed hash", () => {
    assert.equal(isPendingSync("abc123", "def456"), true);
  });
});

suite("classifySyncStatus", () => {
  test("is 'new' when there's no committed sha yet", () => {
    assert.equal(classifySyncStatus(undefined, "abc123"), "new");
  });

  test("is 'pending' when the file no longer exists on disk", () => {
    assert.equal(classifySyncStatus("abc123", undefined), "pending");
  });

  test("is 'pending' when on-disk content differs from the committed sha", () => {
    assert.equal(classifySyncStatus("abc123", "def456"), "pending");
  });

  test("is 'synced' when on-disk content matches the committed sha", () => {
    assert.equal(classifySyncStatus("abc123", "abc123"), "synced");
  });
});
