import * as assert from "node:assert/strict";
import { extractMarkdownLinks } from "../crawler/linkExtractor";

suite("extractMarkdownLinks", () => {
  test("extracts a relative markdown link with its position", () => {
    const links = extractMarkdownLinks("See [the spec](./spec.v1.md) for details.");

    assert.equal(links.length, 1);
    assert.deepEqual(links[0], {
      text: "the spec",
      target: "./spec.v1.md",
      lineIndex: 0,
      startCol: 4,
      endCol: 28,
    });
  });

  test("skips http/https links", () => {
    const links = extractMarkdownLinks("[external](https://example.com) and [secure](http://example.com)");

    assert.equal(links.length, 0);
  });

  test("skips same-file anchor-only links", () => {
    const links = extractMarkdownLinks("[jump](#section)");

    assert.equal(links.length, 0);
  });

  test("finds links across multiple lines", () => {
    const content = ["[one](a.md)", "no link here", "[two](b.md)"].join("\n");

    const links = extractMarkdownLinks(content);

    assert.equal(links.length, 2);
    assert.equal(links[0].lineIndex, 0);
    assert.equal(links[1].lineIndex, 2);
  });
});
