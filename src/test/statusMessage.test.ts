import * as assert from "node:assert/strict";
import { applyFilterPrefix, computeStatusMessage } from "../extension";

suite("computeStatusMessage", () => {
  test("returns undefined when there are zero docs and zero missing", () => {
    assert.equal(computeStatusMessage(0, 0, 0, 0), undefined);
  });

  test("returns a formatted summary when there are tracked docs, even with zero broken links/orphans", () => {
    assert.equal(computeStatusMessage(12, 0, 0, 0), "12 docs · 0 missing · 0 broken links · 0 orphans");
  });

  test("returns a formatted summary when there are missing tracked files, even with zero docs", () => {
    assert.equal(computeStatusMessage(0, 3, 0, 0), "0 docs · 3 missing · 0 broken links · 0 orphans");
  });
});

suite("applyFilterPrefix", () => {
  test("passes the base message through unchanged when there's no active filter", () => {
    assert.equal(applyFilterPrefix("12 docs · 0 missing · 0 broken links · 0 orphans", ""), "12 docs · 0 missing · 0 broken links · 0 orphans");
  });

  test("prefixes the base message with the active filter", () => {
    assert.equal(
      applyFilterPrefix("12 docs · 0 missing · 0 broken links · 0 orphans", "search"),
      'Filter: "search" · 12 docs · 0 missing · 0 broken links · 0 orphans'
    );
  });

  test("returns just the filter prefix when the base message is undefined", () => {
    assert.equal(applyFilterPrefix(undefined, "search"), 'Filter: "search"');
  });
});
