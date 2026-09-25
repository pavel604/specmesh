import { DeclaredRepo, DocNode, Problem } from "../model/types";

const MAX_RESULTS = 200;

/** Problem.docId is "<workspaceFolderName>::<relativePath-or-glob>" -- see crawler.ts/graph.ts. */
function folderOf(docId: string): string {
  return docId.split("::")[0];
}

export interface ListDocsInput {
  folder?: string;
  type?: string;
  query?: string;
}

export function listDocs(nodes: DocNode[], input: ListDocsInput): string {
  const { folder, type, query } = input;
  const q = query?.toLowerCase();
  const filtered = nodes.filter(
    (n) =>
      (!folder || n.workspaceFolderName === folder) &&
      (!type || n.type === type) &&
      (!q || n.title.toLowerCase().includes(q) || n.relativePath.toLowerCase().includes(q))
  );
  if (filtered.length === 0) {
    return "No tracked docs matched. Use no filters to see everything, or check folder/type spelling.";
  }
  const shown = filtered.slice(0, MAX_RESULTS);
  const lines = shown.map((n) => `- [${n.workspaceFolderName}] (${n.type}) ${n.title} -- ${n.relativePath}`);
  const suffix =
    filtered.length > shown.length
      ? `\n... and ${filtered.length - shown.length} more (narrow with folder/type/query).`
      : "";
  return `${filtered.length} doc(s) found:\n${lines.join("\n")}${suffix}`;
}

export function findBrokenLinks(problems: Problem[], folder: string | undefined): string {
  const filtered = problems.filter((p) => p.kind === "broken-link" && (!folder || folderOf(p.docId) === folder));
  if (filtered.length === 0) {
    return folder ? `No broken links in ${folder}.` : "No broken links in the workspace.";
  }
  const shown = filtered.slice(0, MAX_RESULTS);
  const lines = shown.map((p) => `- [${folderOf(p.docId)}] ${p.message}`);
  return `${filtered.length} broken link(s):\n${lines.join("\n")}`;
}

export function findOrphans(problems: Problem[], folder: string | undefined): string {
  const filtered = problems.filter((p) => p.kind === "orphan" && (!folder || folderOf(p.docId) === folder));
  if (filtered.length === 0) {
    return folder ? `No orphaned docs in ${folder}.` : "No orphaned docs in the workspace.";
  }
  const shown = filtered.slice(0, MAX_RESULTS);
  const lines = shown.map((p) => `- [${folderOf(p.docId)}] ${p.message}`);
  return `${filtered.length} orphaned doc(s) (ADRs/reference/FR specs nothing else links to):\n${lines.join("\n")}`;
}

export function findMissingDocs(missingProblems: Problem[], folder: string | undefined): string {
  const filtered = missingProblems.filter((p) => !folder || p.workspaceFolderName === folder);
  if (filtered.length === 0) {
    return folder ? `No missing tracked files in ${folder}.` : "No missing tracked files in the workspace.";
  }
  const lines = filtered.map((p) => `- [${p.workspaceFolderName}] ${p.categoryLabel ?? p.docType}: ${p.expectedPath}`);
  return `${filtered.length} missing tracked file(s):\n${lines.join("\n")}`;
}

export function listRepos(repos: DeclaredRepo[], folder: string | undefined): string {
  const filtered = repos.filter((r) => !folder || r.workspaceFolderName === folder);
  if (filtered.length === 0) {
    return folder
      ? `No repos declared in ${folder}'s .specmesh.yml.`
      : "No repos declared in any workspace folder's .specmesh.yml.";
  }
  const lines = filtered.map(
    (r) => `- [${r.workspaceFolderName}] ${r.name} -- ${r.path} (${r.present ? "present" : "NOT PRESENT"}) <- ${r.remote}`
  );
  return `${filtered.length} declared repo(s):\n${lines.join("\n")}`;
}

export function getDocLinks(nodes: DocNode[], targetPath: string): string {
  const target = targetPath.replace(/\\/g, "/").toLowerCase();
  const matches = nodes.filter((n) => {
    const rel = n.relativePath.toLowerCase();
    const abs = n.absolutePath.replace(/\\/g, "/").toLowerCase();
    return rel === target || rel.endsWith("/" + target) || abs === target || abs.endsWith("/" + target);
  });

  if (matches.length === 0) {
    return `No tracked doc matched "${targetPath}". Use specmesh_list_docs to find the exact path.`;
  }
  if (matches.length > 1) {
    const lines = matches.map((n) => `- [${n.workspaceFolderName}] ${n.relativePath}`);
    return `Multiple docs matched "${targetPath}", be more specific:\n${lines.join("\n")}`;
  }

  const node = matches[0];
  if (node.links.length === 0) {
    return `${node.relativePath} (${node.workspaceFolderName}) has no outgoing markdown links.`;
  }
  const lines = node.links.map((l) => `- "${l.text}" -> ${l.rawTarget} [${l.exists ? "resolves" : "BROKEN"}]`);
  return `${node.relativePath} (${node.workspaceFolderName}) links to:\n${lines.join("\n")}`;
}
