import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { crawlPaths } from "../crawler/crawlNode";

function writeFile(root: string, relativePath: string, content: string): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
}

suite("crawlPaths", () => {
  let tempDir: string;

  setup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "specmesh-crawlnode-"));
  });

  teardown(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("crawls a tracked file, parsing its title and resolving a link", async () => {
    writeFile(
      tempDir,
      ".specmesh.yml",
      ["track:", "  - type: doc", "    label: Docs", "    glob: docs/*.md"].join("\n")
    );
    writeFile(tempDir, "docs/charter.md", "# Charter\n\nSee [ADR](adr/ADR-001.md).\n");
    writeFile(tempDir, "docs/adr/ADR-001.md", "# ADR 1\n");

    const result = await crawlPaths([{ name: "root", path: tempDir }]);

    assert.equal(result.nodes.length, 1);
    const [node] = result.nodes;
    assert.equal(node.title, "Charter");
    assert.equal(node.relativePath, "docs/charter.md");
    assert.equal(node.links.length, 1);
    assert.equal(node.links[0].exists, true);
  });

  test("flags a literal (wildcard-free) glob with no match as missing", async () => {
    writeFile(
      tempDir,
      ".specmesh.yml",
      ["track:", "  - type: readme", "    label: Readme", "    glob: README.md"].join("\n")
    );

    const result = await crawlPaths([{ name: "root", path: tempDir }]);

    assert.equal(result.missingProblems.length, 1);
    assert.equal(result.missingProblems[0].docType, "readme");
  });

  test("honors a brace-list exclude alongside the built-in .specmesh/** exclude", async () => {
    writeFile(
      tempDir,
      ".specmesh.yml",
      [
        "track:",
        "  - type: doc",
        "    label: Docs",
        "    glob: docs/**/*.md",
        "    exclude:",
        "      - docs/{drafts,temp}/**",
      ].join("\n")
    );
    writeFile(tempDir, "docs/kept.md", "# Kept\n");
    writeFile(tempDir, "docs/drafts/draft.md", "# Draft\n");
    writeFile(tempDir, "docs/temp/scratch.md", "# Scratch\n");

    const result = await crawlPaths([{ name: "root", path: tempDir }]);

    assert.deepEqual(
      result.nodes.map((n) => n.relativePath).sort(),
      ["docs/kept.md"]
    );
  });

  test("reports a declared repo missing from disk", async () => {
    writeFile(
      tempDir,
      ".specmesh.yml",
      ["repos:", "  - name: Web", "    remote: git@example.com:org/web.git", "    path: web"].join("\n")
    );

    const result = await crawlPaths([{ name: "root", path: tempDir }]);

    assert.equal(result.repos.length, 1);
    assert.equal(result.repos[0].present, false);
    assert.equal(
      result.missingProblems.some((p) => p.docType === "repo-manifest"),
      true
    );
  });
});
