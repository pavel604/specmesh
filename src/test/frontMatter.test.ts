import * as assert from "node:assert/strict";
import { parseFrontMatter } from "../crawler/frontMatter";

suite("parseFrontMatter", () => {
  test("parses title and metadata lines up to the first heading", () => {
    const content = [
      "# FR-001: Some Feature",
      "",
      "**Status**: Draft",
      "**Repos**: specmesh",
      "",
      "## Overview",
      "**Not**: metadata",
    ].join("\n");

    const result = parseFrontMatter(content);

    assert.equal(result.title, "FR-001: Some Feature");
    assert.deepEqual(result.metadata, { Status: "Draft", Repos: "specmesh" });
  });

  test("returns an empty title, but still parses metadata lines, when there is no leading title", () => {
    const result = parseFrontMatter("just some text\n**Key**: value");

    assert.equal(result.title, "");
    assert.deepEqual(result.metadata, { Key: "value" });
  });

  test("handles metadata lines without a value", () => {
    const result = parseFrontMatter("# Title\n**Flag**:");

    assert.equal(result.metadata.Flag, "");
  });
});
