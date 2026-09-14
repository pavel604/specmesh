import * as assert from "node:assert/strict";
import { computeStatusMessage } from "../extension";

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
