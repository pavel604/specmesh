import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parseFrontMatter } from "./frontMatter";
import { extractMarkdownLinks } from "./linkExtractor";
import { getDocTypeDefinitions } from "./docTypes";
import { isLiteralGlob, loadRepoConfig } from "./repoConfig";
import { attachParentIds, buildChildTypeOrder, flattenDocTypes } from "./docTypeTree";
import { DeclaredRepo, DocLink, DocNode, Problem } from "../model/types";

const WORKSPACE_FOLDER_VAR = "${workspaceFolder}";

export function resolveLinkTarget(fromFile: string, target: string, workspaceFolderPath: string): string | null {
  const withoutAnchor = target.split("#")[0];
  if (!withoutAnchor) {
    return null;
  }
  if (withoutAnchor === WORKSPACE_FOLDER_VAR) {
    return path.resolve(workspaceFolderPath);
  }
  if (withoutAnchor.startsWith(`${WORKSPACE_FOLDER_VAR}/`)) {
    return path.resolve(workspaceFolderPath, withoutAnchor.slice(WORKSPACE_FOLDER_VAR.length + 1));
  }
  return path.resolve(path.dirname(fromFile), withoutAnchor);
}

function existsSafe(target: string): boolean {
  try {
    return fs.existsSync(target);
  } catch {
    return false;
  }
}

/** Merges `.specmesh/**` (the central doc-tracking repo's own storage) into a doc type's `exclude` list,
 * de-duplicating if it's already present. Ensures `.specmesh/spec.git`'s contents are never themselves
 * matched as a tracked doc, even by a broad custom glob like `**\/*.md`. */
export function withSpecmeshExclude(exclude?: string[]): string[] {
  const merged = new Set(exclude ?? []);
  merged.add(".specmesh/**");
  return [...merged];
}

export interface CrawlResult {
  nodes: DocNode[];
  missingProblems: Problem[];
  /** each folder's effective doc-type order (its own .specmesh.yml `track:` order, or the global default),
   * so the tree can render category rows in that same order instead of a hardcoded one. */
  categoryOrder: Map<string, string[]>;
  /** each folder's declared nested-child order, keyed `` `${folderName}::${parentType}` `` -- so the tree
   * can render a parent doc's nested children in their declared order instead of alphabetically. */
  childTypeOrder: Map<string, string[]>;
  /** child repos declared via .specmesh.yml `repos:`, across all workspace folders */
  repos: DeclaredRepo[];
}

export async function crawlWorkspace(): Promise<CrawlResult> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const globalDefs = getDocTypeDefinitions();
  const nodes: DocNode[] = [];
  const missingProblems: Problem[] = [];
  const categoryOrder = new Map<string, string[]>();
  const childTypeOrder = new Map<string, string[]>();
  const seenPaths = new Set<string>();
  const repos: DeclaredRepo[] = [];

  for (const folder of folders) {
    const repoConfig = await loadRepoConfig(folder);
    const defs = repoConfig.track ?? globalDefs;
    categoryOrder.set(folder.name, defs.map((d) => d.type));
    for (const [parentType, childTypes] of buildChildTypeOrder(defs)) {
      childTypeOrder.set(`${folder.name}::${parentType}`, childTypes);
    }

    for (const message of repoConfig.repoErrors ?? []) {
      missingProblems.push({
        kind: "missing",
        docId: `${folder.name}::repo-manifest-error:${message}`,
        absolutePath: path.join(folder.uri.fsPath, ".specmesh.yml"),
        message,
        workspaceFolderName: folder.name,
        docType: "repo-manifest",
        categoryLabel: "Declared Repos",
      });
    }

    for (const message of repoConfig.trackErrors ?? []) {
      missingProblems.push({
        kind: "missing",
        docId: `${folder.name}::track-error:${message}`,
        absolutePath: path.join(folder.uri.fsPath, ".specmesh.yml"),
        message,
        workspaceFolderName: folder.name,
        docType: "config-error",
        categoryLabel: "Config Issues",
      });
    }

    for (const repo of repoConfig.repos ?? []) {
      const repoPath = path.join(folder.uri.fsPath, repo.path);
      const present = existsSafe(repoPath);
      repos.push({ ...repo, workspaceFolderName: folder.name, present });

      if (!present) {
        missingProblems.push({
          kind: "missing",
          docId: `${folder.name}::missing-repo:${repo.path}`,
          absolutePath: repoPath,
          message: `Declared repo "${repo.name}" not found at "${repo.path}"`,
          workspaceFolderName: folder.name,
          docType: "repo-manifest",
          categoryLabel: "Declared Repos",
          expectedPath: repo.path,
        });
      }
    }

    const folderNodes: DocNode[] = [];

    for (const def of flattenDocTypes(defs)) {
      const pattern = new vscode.RelativePattern(folder, def.glob);
      const mergedExclude = withSpecmeshExclude(def.exclude);
      const excludePattern = new vscode.RelativePattern(
        folder,
        mergedExclude.length === 1 ? mergedExclude[0] : `{${mergedExclude.join(",")}}`
      );
      const files = await vscode.workspace.findFiles(pattern, excludePattern);

      if (files.length === 0 && isLiteralGlob(def.glob)) {
        missingProblems.push({
          kind: "missing",
          docId: `${folder.name}::missing:${def.glob}`,
          absolutePath: path.join(folder.uri.fsPath, def.glob),
          message: `Tracked file "${def.glob}" not found in ${folder.name}`,
          workspaceFolderName: folder.name,
          docType: def.type,
          categoryLabel: def.label,
          expectedPath: def.glob,
        });
        continue;
      }

      for (const uri of files) {
        if (seenPaths.has(uri.fsPath)) {
          continue;
        }
        seenPaths.add(uri.fsPath);

        const bytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(bytes).toString("utf8");
        const { title, metadata } = parseFrontMatter(content);
        const rawLinks = extractMarkdownLinks(content);

        const links: DocLink[] = rawLinks.map((raw) => {
          const resolved = resolveLinkTarget(uri.fsPath, raw.target, folder.uri.fsPath);
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

        const relativePath = path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, "/");
        folderNodes.push({
          id: `${folder.name}::${relativePath}`,
          type: def.type,
          categoryLabel: def.label,
          title: title || relativePath,
          absolutePath: uri.fsPath,
          workspaceFolderName: folder.name,
          workspaceFolderPath: folder.uri.fsPath,
          relativePath,
          metadata,
          links,
          content,
          root: def.root,
        });
      }
    }

    nodes.push(...attachParentIds(folderNodes, defs));
  }

  return { nodes, missingProblems, categoryOrder, childTypeOrder, repos };
}

