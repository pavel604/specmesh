import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parseFrontMatter } from "./frontMatter";
import { extractMarkdownLinks } from "./linkExtractor";
import { getDocTypeDefinitions } from "./docTypes";
import { isLiteralGlob, loadRepoConfig } from "./repoConfig";
import { DocLink, DocNode, Problem } from "../model/types";

function resolveLinkTarget(fromFile: string, target: string): string | null {
  const withoutAnchor = target.split("#")[0];
  if (!withoutAnchor) {
    return null;
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

export interface CrawlResult {
  nodes: DocNode[];
  missingProblems: Problem[];
}

export async function crawlWorkspace(): Promise<CrawlResult> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const globalDefs = getDocTypeDefinitions();
  const nodes: DocNode[] = [];
  const missingProblems: Problem[] = [];
  const seenPaths = new Set<string>();

  for (const folder of folders) {
    const repoConfig = await loadRepoConfig(folder);
    const defs = repoConfig.track ?? globalDefs;

    for (const def of defs) {
      const pattern = new vscode.RelativePattern(folder, def.glob);
      const excludePattern =
        def.exclude && def.exclude.length > 0
          ? new vscode.RelativePattern(
              folder,
              def.exclude.length === 1 ? def.exclude[0] : `{${def.exclude.join(",")}}`
            )
          : undefined;
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
          const resolved = resolveLinkTarget(uri.fsPath, raw.target);
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
        nodes.push({
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
        });
      }
    }
  }

  return { nodes, missingProblems };
}

