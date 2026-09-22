import * as assert from "node:assert/strict";
import * as path from "path";
import { resolveLinkTarget } from "../crawler/crawler";

suite("resolveLinkTarget", () => {
  const workspaceFolderPath = path.join("c:", "repo");

  test("resolves a plain relative target against the linking file's directory (unchanged)", () => {
    const fromFile = path.join(workspaceFolderPath, "docs", "FR-001", "spec.v1.md");

    const resolved = resolveLinkTarget(fromFile, "../charter.md", workspaceFolderPath);

    assert.equal(resolved, path.resolve(workspaceFolderPath, "docs", "charter.md"));
  });

  test("resolves ${workspaceFolder}/... against the workspace folder root", () => {
    const fromFile = path.join(workspaceFolderPath, "docs", "FR-001", "spec.v1.md");

    const resolved = resolveLinkTarget(fromFile, "${workspaceFolder}/docs/charter.md", workspaceFolderPath);

    assert.equal(resolved, path.resolve(workspaceFolderPath, "docs", "charter.md"));
  });

  test("resolves ${workspaceFolder}/... the same way regardless of the linking file's nesting depth", () => {
    const shallow = path.join(workspaceFolderPath, "docs", "charter.md");
    const deep = path.join(workspaceFolderPath, "docs", "FR-018-x", "nested", "spec.v1.md");

    const fromShallow = resolveLinkTarget(shallow, "${workspaceFolder}/README.md", workspaceFolderPath);
    const fromDeep = resolveLinkTarget(deep, "${workspaceFolder}/README.md", workspaceFolderPath);

    assert.equal(fromShallow, path.resolve(workspaceFolderPath, "README.md"));
    assert.equal(fromDeep, path.resolve(workspaceFolderPath, "README.md"));
  });

  test("resolves a bare ${workspaceFolder} (no trailing path) to the folder root itself", () => {
    const fromFile = path.join(workspaceFolderPath, "docs", "spec.v1.md");

    const resolved = resolveLinkTarget(fromFile, "${workspaceFolder}", workspaceFolderPath);

    assert.equal(resolved, path.resolve(workspaceFolderPath));
  });

  test("still resolves a non-existent ${workspaceFolder} target to an absolute path (existence is checked separately)", () => {
    const fromFile = path.join(workspaceFolderPath, "docs", "spec.v1.md");

    const resolved = resolveLinkTarget(fromFile, "${workspaceFolder}/does/not/exist.md", workspaceFolderPath);

    assert.equal(resolved, path.resolve(workspaceFolderPath, "does", "not", "exist.md"));
  });
});
