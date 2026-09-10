import * as vscode from "vscode";
import { parse as parseYaml } from "yaml";
import { DocTypeDefinition } from "../model/types";

const CONFIG_FILENAME = ".specmesh.yml";
const GLOB_SPECIAL_CHARS = /[*?[\]{}]/;

export interface RepoConfig {
  /** replaces (not merges with) the global/default doc types for this repo only, when present */
  track?: DocTypeDefinition[];
}

const EMPTY_CONFIG: RepoConfig = {};

export async function loadRepoConfig(folder: vscode.WorkspaceFolder): Promise<RepoConfig> {
  const uri = vscode.Uri.joinPath(folder.uri, CONFIG_FILENAME);
  let content: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    content = Buffer.from(bytes).toString("utf8");
  } catch {
    return EMPTY_CONFIG;
  }

  const parsed = (parseYaml(content) ?? {}) as Partial<RepoConfig>;
  return {
    track: Array.isArray(parsed.track) && parsed.track.length > 0 ? parsed.track : undefined,
  };
}

/** A glob with no wildcard characters names one specific expected file, so a zero-match result means it's missing. */
export function isLiteralGlob(glob: string): boolean {
  return !GLOB_SPECIAL_CHARS.test(glob);
}

