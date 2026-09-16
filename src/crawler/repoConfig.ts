import * as vscode from "vscode";
import * as path from "path";
import { parse as parseYaml } from "yaml";
import { DocTypeDefinition, RepoManifestEntry } from "../model/types";

const CONFIG_FILENAME = ".specmesh.yml";
const GLOB_SPECIAL_CHARS = /[*?[\]{}]/;

export interface RepoConfig {
  /** replaces (not merges with) the global/default doc types for this repo only, when present */
  track?: DocTypeDefinition[];
  /** declared child repos (name/remote/path), when this .specmesh.yml has a `repos:` list */
  repos?: RepoManifestEntry[];
  /** human-readable reasons any `repos:` entries were dropped as invalid */
  repoErrors?: string[];
}

const EMPTY_CONFIG: RepoConfig = {};

/** Validates a raw `repos:` YAML value into typed entries, dropping (and explaining) any malformed ones. */
export function parseRepoManifest(raw: unknown): { repos: RepoManifestEntry[]; errors: string[] } {
  if (!Array.isArray(raw)) {
    return { repos: [], errors: [] };
  }

  const repos: RepoManifestEntry[] = [];
  const errors: string[] = [];

  raw.forEach((entry, index) => {
    const name = typeof entry?.name === "string" ? entry.name.trim() : "";
    const remote = typeof entry?.remote === "string" ? entry.remote.trim() : "";
    const entryPath = typeof entry?.path === "string" ? entry.path.trim() : "";

    if (!name || !remote || !entryPath) {
      errors.push(`repos[${index}] is missing a required "name", "remote", or "path" field.`);
      return;
    }
    if (path.isAbsolute(entryPath)) {
      errors.push(`repos[${index}] ("${name}").path must be relative, got "${entryPath}".`);
      return;
    }

    repos.push({ name, remote, path: entryPath });
  });

  return { repos, errors };
}

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
  const { repos, errors } = parseRepoManifest(parsed.repos);
  return {
    track: Array.isArray(parsed.track) && parsed.track.length > 0 ? parsed.track : undefined,
    repos: repos.length > 0 ? repos : undefined,
    repoErrors: errors.length > 0 ? errors : undefined,
  };
}

/** A glob with no wildcard characters names one specific expected file, so a zero-match result means it's missing. */
export function isLiteralGlob(glob: string): boolean {
  return !GLOB_SPECIAL_CHARS.test(glob);
}

