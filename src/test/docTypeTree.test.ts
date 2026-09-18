import * as assert from "node:assert/strict";
import {
  flattenDocTypes,
  buildParentTypeMap,
  findDuplicateTypes,
  buildChildTypeOrder,
  attachParentIds,
  sortDocsReverseChronological,
} from "../crawler/docTypeTree";
import { DocTypeDefinition, DocNode } from "../model/types";

const flatDefs: DocTypeDefinition[] = [
  { type: "adr", label: "ADRs", glob: "docs/adr/ADR-*.md" },
  { type: "reference", label: "Reference", glob: "docs/reference/*.md" },
];

const nestedDefs: DocTypeDefinition[] = [
  {
    type: "fr-spec",
    label: "FR Specs",
    glob: "docs/FR-*/spec.v*.md",
    children: [
      { type: "fr-plan", label: "FR Plans", glob: "docs/FR-*/plan.v*.md" },
      {
        type: "fr-tasks",
        label: "FR Tasks",
        glob: "docs/FR-*/tasks.v*.md",
        children: [{ type: "fr-tasks-sub", label: "FR Tasks Sub", glob: "docs/FR-*/tasks-sub.v*.md" }],
      },
    ],
  },
  { type: "adr", label: "ADRs", glob: "docs/adr/ADR-*.md" },
];

suite("flattenDocTypes", () => {
  test("returns the same list when there's no nesting", () => {
    assert.deepEqual(flattenDocTypes(flatDefs), flatDefs);
  });

  test("includes children and grandchildren, depth-first", () => {
    const flat = flattenDocTypes(nestedDefs).map((d) => d.type);
    assert.deepEqual(flat, ["fr-spec", "fr-plan", "fr-tasks", "fr-tasks-sub", "adr"]);
  });
});

suite("buildParentTypeMap", () => {
  test("is empty when there's no nesting", () => {
    assert.deepEqual(buildParentTypeMap(flatDefs), new Map());
  });

  test("maps children and grandchildren to their declared parent", () => {
    const parentOf = buildParentTypeMap(nestedDefs);
    assert.equal(parentOf.get("fr-plan"), "fr-spec");
    assert.equal(parentOf.get("fr-tasks"), "fr-spec");
    assert.equal(parentOf.get("fr-tasks-sub"), "fr-tasks");
    assert.equal(parentOf.get("adr"), undefined);
  });
});

suite("findDuplicateTypes", () => {
  test("returns an empty array when every type is unique", () => {
    assert.deepEqual(findDuplicateTypes(nestedDefs), []);
  });

  test("finds a duplicate between two top-level entries", () => {
    const defs = [...flatDefs, { type: "adr", label: "ADRs (dup)", glob: "docs/other/*.md" }];
    assert.deepEqual(findDuplicateTypes(defs), ["adr"]);
  });

  test("finds a duplicate between a top-level entry and a nested child", () => {
    const defs: DocTypeDefinition[] = [
      ...nestedDefs,
      { type: "fr-plan", label: "FR Plans (dup)", glob: "docs/other/*.md" },
    ];
    assert.deepEqual(findDuplicateTypes(defs), ["fr-plan"]);
  });
});

suite("buildChildTypeOrder", () => {
  test("is empty when there's no nesting", () => {
    assert.deepEqual(buildChildTypeOrder(flatDefs), new Map());
  });

  test("records declared order at every nesting level", () => {
    const order = buildChildTypeOrder(nestedDefs);
    assert.deepEqual(order.get("fr-spec"), ["fr-plan", "fr-tasks"]);
    assert.deepEqual(order.get("fr-tasks"), ["fr-tasks-sub"]);
    assert.equal(order.get("fr-plan"), undefined);
  });
});

function makeNode(overrides: Partial<DocNode>): DocNode {
  return {
    id: overrides.relativePath ?? "id",
    type: "doc",
    categoryLabel: "Docs",
    title: "Title",
    absolutePath: `/repo/${overrides.relativePath}`,
    workspaceFolderName: "repo",
    workspaceFolderPath: "/repo",
    relativePath: "doc.md",
    metadata: {},
    links: [],
    ...overrides,
  };
}

suite("attachParentIds", () => {
  const defs: DocTypeDefinition[] = [
    {
      type: "fr-spec",
      label: "FR Specs",
      glob: "docs/FR-*/spec.v*.md",
      children: [{ type: "fr-plan", label: "FR Plans", glob: "docs/FR-*/plan.v*.md" }],
    },
  ];

  test("matches a child to the parent sharing its directory and version", () => {
    const spec = makeNode({ id: "spec", type: "fr-spec", relativePath: "docs/FR-001-x/spec.v1.md" });
    const plan = makeNode({ id: "plan", type: "fr-plan", relativePath: "docs/FR-001-x/plan.v1.md" });

    const [resultSpec, resultPlan] = attachParentIds([spec, plan], defs);
    assert.equal(resultSpec.parentId, undefined);
    assert.equal(resultPlan.parentId, "spec");
  });

  test("does not match a child to a different version of the parent", () => {
    const spec = makeNode({ id: "spec-v1", type: "fr-spec", relativePath: "docs/FR-001-x/spec.v1.md" });
    const plan = makeNode({ id: "plan-v2", type: "fr-plan", relativePath: "docs/FR-001-x/plan.v2.md" });

    const [, resultPlan] = attachParentIds([spec, plan], defs);
    assert.equal(resultPlan.parentId, undefined);
  });

  test("leaves nodes unmatched when defs declare no nesting", () => {
    const plan = makeNode({ id: "plan", type: "fr-plan", relativePath: "docs/FR-001-x/plan.v1.md" });
    assert.deepEqual(attachParentIds([plan], []), [plan]);
  });
});

suite("sortDocsReverseChronological", () => {
  test("sorts by Created descending when every node has it", () => {
    const oldest = makeNode({ id: "a", title: "A", metadata: { Created: "2026-09-01" } });
    const newest = makeNode({ id: "b", title: "B", metadata: { Created: "2026-09-18" } });
    const middle = makeNode({ id: "c", title: "C", metadata: { Created: "2026-09-10" } });

    const sorted = sortDocsReverseChronological([oldest, newest, middle]).map((n) => n.id);
    assert.deepEqual(sorted, ["b", "c", "a"]);
  });

  test("falls back to Date when Created is absent", () => {
    const oldest = makeNode({ id: "a", metadata: { Date: "2026-09-01" } });
    const newest = makeNode({ id: "b", metadata: { Date: "2026-09-18" } });

    const sorted = sortDocsReverseChronological([oldest, newest]).map((n) => n.id);
    assert.deepEqual(sorted, ["b", "a"]);
  });

  test("ranks dated nodes above undated ones", () => {
    const dated = makeNode({ id: "dated", metadata: { Created: "2026-01-01" } });
    const undated = makeNode({ id: "undated", metadata: {} });

    const sorted = sortDocsReverseChronological([undated, dated]).map((n) => n.id);
    assert.deepEqual(sorted, ["dated", "undated"]);
  });

  test("falls back to reverse title order when no dates are present", () => {
    const a = makeNode({ id: "a", title: "ADR-001", metadata: {} });
    const b = makeNode({ id: "b", title: "ADR-002", metadata: {} });

    const sorted = sortDocsReverseChronological([a, b]).map((n) => n.id);
    assert.deepEqual(sorted, ["b", "a"]);
  });
});

