import * as fs from "fs";
import * as path from "path";

const WORKSPACE_FOLDER_VAR = "${workspaceFolder}";

/** vscode-free doc-path helpers shared by the vscode-backed crawl (`crawler.ts`) and the Node-fs-backed crawl
 * (`crawlNode.ts`, used by the standalone MCP server) -- kept out of `crawler.ts` itself so importing them
 * never transitively pulls in `import * as vscode from "vscode"`, which would crash outside an extension host. */

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

export function existsSafe(target: string): boolean {
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
