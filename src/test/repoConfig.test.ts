import * as assert from "node:assert/strict";
import { parseRepoManifest, dropLaterDuplicates } from "../crawler/repoConfig";
import { findDuplicateTypes } from "../crawler/docTypeTree";
import { DocTypeDefinition } from "../model/types";

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

suite("dropLaterDuplicates", () => {
  test("leaves a tree with no duplicate types untouched", () => {
    const defs: DocTypeDefinition[] = [
      { type: "adr", label: "ADRs", glob: "docs/adr/ADR-*.md" },
      {
        type: "fr-spec",
        label: "FR Specs",
        glob: "docs/FR-*/spec.v*.md",
        children: [{ type: "fr-plan", label: "FR Plans", glob: "docs/FR-*/plan.v*.md" }],
      },
    ];

    assert.deepEqual(findDuplicateTypes(defs), []);
    assert.deepEqual(dropLaterDuplicates(defs), defs);
  });

  test("drops a later top-level duplicate, keeping the first occurrence", () => {
    const defs: DocTypeDefinition[] = [
      { type: "adr", label: "ADRs", glob: "docs/adr/ADR-*.md" },
      { type: "adr", label: "ADRs (dup)", glob: "docs/other/*.md" },
    ];

    assert.deepEqual(findDuplicateTypes(defs), ["adr"]);
    assert.deepEqual(dropLaterDuplicates(defs), [{ type: "adr", label: "ADRs", glob: "docs/adr/ADR-*.md" }]);
  });

  test("drops a duplicate nested under a different parent, keeping the earlier one", () => {
    const defs: DocTypeDefinition[] = [
      {
        type: "fr-spec",
        label: "FR Specs",
        glob: "docs/FR-*/spec.v*.md",
        children: [{ type: "fr-plan", label: "FR Plans", glob: "docs/FR-*/plan.v*.md" }],
      },
      { type: "fr-plan", label: "FR Plans (dup)", glob: "docs/other/*.md" },
    ];

    assert.deepEqual(findDuplicateTypes(defs), ["fr-plan"]);
    const deduped = dropLaterDuplicates(defs);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].children?.length, 1);
    assert.equal(deduped[0].children?.[0].label, "FR Plans");
  });
});

