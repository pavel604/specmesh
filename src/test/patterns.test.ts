import * as assert from "node:assert/strict";
import { BUILTIN_PACK_DATA } from "../scaffold/patterns";
import { buildSpecmeshYml } from "../scaffold/scaffold";

suite("BUILTIN_PACK_DATA", () => {
  test("has a non-empty docTypes list and the charter/sdd/epic root-only entries", () => {
    assert.ok(BUILTIN_PACK_DATA.docTypes.length > 0);
    assert.deepEqual(
      BUILTIN_PACK_DATA.rootDocTypes.map((d) => d.type),
      ["charter", "sdd", "epic"]
    );
  });
});

suite("buildSpecmeshYml", () => {
  test("includes only docTypes for a non-root repo", () => {
    const yml = buildSpecmeshYml(BUILTIN_PACK_DATA, false);
    assert.ok(!yml.includes("type: charter"));
    assert.ok(yml.includes("type: adr"));
  });

  test("includes rootDocTypes before docTypes for the root repo", () => {
    const yml = buildSpecmeshYml(BUILTIN_PACK_DATA, true);
    assert.ok(yml.includes("type: charter"));
    assert.ok(yml.indexOf("type: charter") < yml.indexOf("type: adr"));
  });
});
