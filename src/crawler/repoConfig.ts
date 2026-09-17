import * as vscode from "vscode";
import * as path from "path";
import { parse as parseYaml } from "yaml";
import { DocTypeDefinition, RepoManifestEntry } from "../model/types";
import { findDuplicateTypes } from "./docTypeTree";

const CONFIG_FILENAME = ".specmesh.yml";
const GLOB_SPECIAL_CHARS = /[*?[\]{}]/;

export interface RepoConfig {
  /** replaces (not merges with) the global/default doc types for this repo only, when present */
  track?: DocTypeDefinition[];
  /** declared child repos (name/remote/path), when this .specmesh.yml has a `repos:` list */
  repos?: RepoManifestEntry[];
  /** human-readable reasons any `repos:` entries were dropped as invalid */
  repoErrors?: string[];
  /** human-readable reasons any `track:` entries were dropped for reusing a `type` already declared
   * elsewhere in the tree (top-level or nested) */
  trackErrors?: string[];
}

/** Drops every occurrence of a `type` after its first (depth-first, top-level before children), dropping a
 * duplicate's own nested `children` along with it. Exported for testing alongside `findDuplicateTypes`. */
export function dropLaterDuplicates(defs: DocTypeDefinition[], seen: Set<string> = new Set()): DocTypeDefinition[] {
  const kept: DocTypeDefinition[] = [];
  for (const def of defs) {
    if (seen.has(def.type)) {
      continue;
    }
    seen.add(def.type);
    kept.push(def.children ? { ...def, children: dropLaterDuplicates(def.children, seen) } : def);
  }
  return kept;
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

  const rawTrack = Array.isArray(parsed.track) && parsed.track.length > 0 ? parsed.track : undefined;
  const duplicateTypes = rawTrack ? findDuplicateTypes(rawTrack) : [];
  const track = duplicateTypes.length > 0 ? dropLaterDuplicates(rawTrack!) : rawTrack;
  const trackErrors = duplicateTypes.map(
    (type) => `track: duplicate "type: ${type}" entry -- keeping the first occurrence, dropping the rest.`
  );

  return {
    track,
    repos: repos.length > 0 ? repos : undefined,
    repoErrors: errors.length > 0 ? errors : undefined,
    trackErrors: trackErrors.length > 0 ? trackErrors : undefined,
  };
}

/** A glob with no wildcard characters names one specific expected file, so a zero-match result means it's missing. */
export function isLiteralGlob(glob: string): boolean {
  return !GLOB_SPECIAL_CHARS.test(glob);
}

