# Tasks: FR-005 Docs Tree Problem Indicator (v1)

- [ ] T1 — Add `problemsByFolder`/`problemsByCategory` aggregation maps to `DocsTreeProvider`, populated in
      `update()` from `this.missing` and from `nodes` + `brokenLinkCounts`.
- [ ] T2 — Add `problemIcon(counts)` and `problemTooltip(counts)` private helpers.
- [ ] T3 — Wire the helpers into the `"folder"` branch of `getTreeItem`.
- [ ] T4 — Wire the helpers into the `"category"` branch of `getTreeItem`.
- [ ] T5 — Add/update tests covering the aggregation + icon/tooltip precedence logic.
- [ ] T6 — Manually verify in the Extension Development Host: a broken link and a missing tracked file each
      surface the right folder/category icon+tooltip, and clear once fixed.
