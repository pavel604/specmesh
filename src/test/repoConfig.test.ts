import * as assert from "node:assert/strict";
import { parseRepoManifest } from "../crawler/repoConfig";

suite("parseRepoManifest", () => {
  test("parses valid entries", () => {
    const result = parseRepoManifest([
      { name: "Blazor Server", remote: "git@github.com:pavel604/webapp.git", path: "./web" },
    ]);

    assert.deepEqual(result.repos, [
      { name: "Blazor Server", remote: "git@github.com:pavel604/webapp.git", path: "./web" },
    ]);
    assert.deepEqual(result.errors, []);
  });

  test("returns empty result for a non-array value", () => {
    const result = parseRepoManifest(undefined);

    assert.deepEqual(result.repos, []);
    assert.deepEqual(result.errors, []);
  });

  test("drops an entry missing name/remote/path and explains why", () => {
    const result = parseRepoManifest([{ name: "Terraform", remote: "git@github.com:pavel604/tf.git" }]);

    assert.deepEqual(result.repos, []);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /repos\[0\]/);
  });

  test("drops an entry with an absolute path and explains why", () => {
    const result = parseRepoManifest([
      { name: "Terraform", remote: "git@github.com:pavel604/tf.git", path: "/repos/tf" },
    ]);

    assert.deepEqual(result.repos, []);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /must be relative/);
  });
});
