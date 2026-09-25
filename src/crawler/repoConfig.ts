import * as vscode from "vscode";
import { parseDocument } from "yaml";
import { CONFIG_FILENAME, EMPTY_CONFIG, RepoConfig, parseRepoConfigContent } from "./repoConfigCore";

export type { RepoConfig } from "./repoConfigCore";
export {
  dropLaterDuplicates,
  isLiteralGlob,
  loadRepoConfigFromPath,
  mergeTrackEntry,
  parseRepoManifest,
  parseSpecRepoRemote,
} from "./repoConfigCore";

export async function loadRepoConfig(folder: vscode.WorkspaceFolder): Promise<RepoConfig> {
  const uri = vscode.Uri.joinPath(folder.uri, CONFIG_FILENAME);
  let content: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    content = Buffer.from(bytes).toString("utf8");
  } catch {
    return EMPTY_CONFIG;
  }

  return parseRepoConfigContent(content);
}

/** Sets (or, when `value` is `undefined`, deletes) `specRepoRemote:` in `folder`'s `.specmesh.yml`, preserving
 * the rest of the file's formatting/comments via `yaml`'s CST-editing `Document` API instead of a full
 * parse-and-restringify round-trip. Creates the file if it doesn't exist yet. */
export async function writeSpecRepoRemote(folder: vscode.WorkspaceFolder, value: string | undefined): Promise<void> {
  const uri = vscode.Uri.joinPath(folder.uri, CONFIG_FILENAME);
  let content = "";
  try {
    content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
  } catch {
    // no .specmesh.yml yet -- start from an empty document
  }

  const doc = parseDocument(content);
  if (value === undefined) {
    doc.delete("specRepoRemote");
  } else {
    doc.set("specRepoRemote", value);
  }

  await vscode.workspace.fs.writeFile(uri, Buffer.from(doc.toString(), "utf8"));
}

