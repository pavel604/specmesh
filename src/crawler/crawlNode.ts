import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import { parseFrontMatter } from "./frontMatter";
import { extractMarkdownLinks } from "./linkExtractor";
import { getBuiltinDefaultDocTypes } from "./docTypesCore";
import { isLiteralGlob, loadRepoConfigFromPath } from "./repoConfigCore";
import { attachParentIds, buildChildTypeOrder, flattenDocTypes } from "./docTypeTree";
import { existsSafe, resolveLinkTarget, withSpecmeshExclude } from "./docPaths";
import { DeclaredRepo, DocLink, DocNode, Problem } from "../model/types";
import type { CrawlResult } from "./crawler";

export interface WorkspaceRoot {
  /** stands in for a vscode.WorkspaceFolder's name in the standalone (no-VS-Code) MCP server. */
  name: string;
  /** absolute path to the root. */
  path: string;
}

/** Node-fs-backed twin of `crawlWorkspace()` (crawler.ts), for the standalone MCP server -- which has no
 * `vscode.workspace.workspaceFolders`/`findFiles`/`fs` to crawl through. Mirrors the same traversal shape and
 * reuses every vscode-free parsing/link helper unchanged; only file discovery/reading differs (fast-glob +
 * `fs/promises` instead of `vscode.workspace.findFiles`/`fs.readFile`). specmesh's `specmesh.docTypes` VS Code
 * setting has no equivalent here -- the built-in defaults are the global fallback, same as a fresh
 * `.specmesh.yml` would be seeded with. */
export async function crawlPaths(roots: WorkspaceRoot[]): Promise<CrawlResult> {
  const globalDefs = getBuiltinDefaultDocTypes();
  const nodes: DocNode[] = [];
  const missingProblems: Problem[] = [];
  const categoryOrder = new Map<string, string[]>();
  const childTypeOrder = new Map<string, string[]>();
  const seenPaths = new Set<string>();
  const repos: DeclaredRepo[] = [];

  for (const root of roots) {
    const repoConfig = await loadRepoConfigFromPath(root.path);
    const defs = repoConfig.track ?? globalDefs;
    categoryOrder.set(root.name, defs.map((d) => d.type));
    for (const [parentType, childTypes] of buildChildTypeOrder(defs)) {
      childTypeOrder.set(`${root.name}::${parentType}`, childTypes);
    }

    for (const message of repoConfig.repoErrors ?? []) {
      missingProblems.push({
        kind: "missing",
        docId: `${root.name}::repo-manifest-error:${message}`,
        absolutePath: path.join(root.path, ".specmesh.yml"),
        message,
        workspaceFolderName: root.name,
        docType: "repo-manifest",
        categoryLabel: "Declared Repos",
      });
    }

    for (const message of repoConfig.trackErrors ?? []) {
      missingProblems.push({
        kind: "missing",
        docId: `${root.name}::track-error:${message}`,
        absolutePath: path.join(root.path, ".specmesh.yml"),
        message,
        workspaceFolderName: root.name,
        docType: "config-error",
        categoryLabel: "Config Issues",
      });
    }

    for (const repo of repoConfig.repos ?? []) {
      const repoPath = path.join(root.path, repo.path);
      const present = existsSafe(repoPath);
      repos.push({ ...repo, workspaceFolderName: root.name, present });

      if (!present) {
        missingProblems.push({
          kind: "missing",
          docId: `${root.name}::missing-repo:${repo.path}`,
          absolutePath: repoPath,
          message: `Declared repo "${repo.name}" not found at "${repo.path}"`,
          workspaceFolderName: root.name,
          docType: "repo-manifest",
          categoryLabel: "Declared Repos",
          expectedPath: repo.path,
        });
      }
    }

    const rootNodes: DocNode[] = [];

    for (const def of flattenDocTypes(defs)) {
      const mergedExclude = withSpecmeshExclude(def.exclude);
      const relativePaths = await fg(def.glob, { cwd: root.path, ignore: mergedExclude, onlyFiles: true });

      if (relativePaths.length === 0 && isLiteralGlob(def.glob)) {
        missingProblems.push({
          kind: "missing",
          docId: `${root.name}::missing:${def.glob}`,
          absolutePath: path.join(root.path, def.glob),
          message: `Tracked file "${def.glob}" not found in ${root.name}`,
          workspaceFolderName: root.name,
          docType: def.type,
          categoryLabel: def.label,
          expectedPath: def.glob,
        });
        continue;
      }

      for (const relativePath of relativePaths) {
        const absolutePath = path.join(root.path, relativePath);
        if (seenPaths.has(absolutePath)) {
          continue;
        }
        seenPaths.add(absolutePath);

        const content = await fs.promises.readFile(absolutePath, "utf8");
        const { title, metadata } = parseFrontMatter(content);
        const rawLinks = extractMarkdownLinks(content);

        const links: DocLink[] = rawLinks.map((raw) => {
          const resolved = resolveLinkTarget(absolutePath, raw.target, root.path);
          return {
            text: raw.text,
            rawTarget: raw.target,
            resolvedAbsolutePath: resolved,
            exists: resolved !== null && existsSafe(resolved),
            lineIndex: raw.lineIndex,
            startCol: raw.startCol,
            endCol: raw.endCol,
          };
        });

        rootNodes.push({
          id: `${root.name}::${relativePath}`,
          type: def.type,
          categoryLabel: def.label,
          title: title || relativePath,
          absolutePath,
          workspaceFolderName: root.name,
          workspaceFolderPath: root.path,
          relativePath,
          metadata,
          links,
          content,
          root: def.root,
        });
      }
    }

    nodes.push(...attachParentIds(rootNodes, defs));
  }

  return { nodes, missingProblems, categoryOrder, childTypeOrder, repos };
}
