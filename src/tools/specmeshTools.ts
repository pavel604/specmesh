import * as vscode from "vscode";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { crawlWorkspace } from "../crawler/crawler";
import { computeProblems } from "../crawler/graph";
import { getBuiltinDefaultDocTypes } from "../crawler/docTypes";
import { DocTypeDefinition } from "../model/types";

const MAX_RESULTS = 200;

/** Problem.docId is "<workspaceFolderName>::<relativePath-or-glob>" -- see crawler.ts/graph.ts. */
function folderOf(docId: string): string {
  return docId.split("::")[0];
}

function textResult(text: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
}

interface FolderFilterInput {
  folder?: string;
}

interface ListDocsInput extends FolderFilterInput {
  type?: string;
  query?: string;
}

class ListDocsTool implements vscode.LanguageModelTool<ListDocsInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ListDocsInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { folder, type, query } = options.input;
    const { nodes } = await crawlWorkspace();
    const q = query?.toLowerCase();
    const filtered = nodes.filter(
      (n) =>
        (!folder || n.workspaceFolderName === folder) &&
        (!type || n.type === type) &&
        (!q || n.title.toLowerCase().includes(q) || n.relativePath.toLowerCase().includes(q))
    );
    if (filtered.length === 0) {
      return textResult("No tracked docs matched. Use no filters to see everything, or check folder/type spelling.");
    }
    const shown = filtered.slice(0, MAX_RESULTS);
    const lines = shown.map((n) => `- [${n.workspaceFolderName}] (${n.type}) ${n.title} -- ${n.relativePath}`);
    const suffix =
      filtered.length > shown.length
        ? `\n... and ${filtered.length - shown.length} more (narrow with folder/type/query).`
        : "";
    return textResult(`${filtered.length} doc(s) found:\n${lines.join("\n")}${suffix}`);
  }
}

class FindBrokenLinksTool implements vscode.LanguageModelTool<FolderFilterInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FolderFilterInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { folder } = options.input;
    const { nodes } = await crawlWorkspace();
    const problems = computeProblems(nodes).filter(
      (p) => p.kind === "broken-link" && (!folder || folderOf(p.docId) === folder)
    );
    if (problems.length === 0) {
      return textResult(folder ? `No broken links in ${folder}.` : "No broken links in the workspace.");
    }
    const shown = problems.slice(0, MAX_RESULTS);
    const lines = shown.map((p) => `- [${folderOf(p.docId)}] ${p.message}`);
    return textResult(`${problems.length} broken link(s):\n${lines.join("\n")}`);
  }
}

class FindOrphansTool implements vscode.LanguageModelTool<FolderFilterInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FolderFilterInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { folder } = options.input;
    const { nodes } = await crawlWorkspace();
    const problems = computeProblems(nodes).filter(
      (p) => p.kind === "orphan" && (!folder || folderOf(p.docId) === folder)
    );
    if (problems.length === 0) {
      return textResult(folder ? `No orphaned docs in ${folder}.` : "No orphaned docs in the workspace.");
    }
    const shown = problems.slice(0, MAX_RESULTS);
    const lines = shown.map((p) => `- [${folderOf(p.docId)}] ${p.message}`);
    return textResult(`${problems.length} orphaned doc(s) (ADRs/reference/FR specs nothing else links to):\n${lines.join("\n")}`);
  }
}

class FindMissingDocsTool implements vscode.LanguageModelTool<FolderFilterInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FolderFilterInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { folder } = options.input;
    const { missingProblems } = await crawlWorkspace();
    const problems = missingProblems.filter((p) => !folder || p.workspaceFolderName === folder);
    if (problems.length === 0) {
      return textResult(folder ? `No missing tracked files in ${folder}.` : "No missing tracked files in the workspace.");
    }
    const lines = problems.map((p) => `- [${p.workspaceFolderName}] ${p.categoryLabel ?? p.docType}: ${p.expectedPath}`);
    return textResult(`${problems.length} missing tracked file(s):\n${lines.join("\n")}`);
  }
}

class ListReposTool implements vscode.LanguageModelTool<FolderFilterInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FolderFilterInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { folder } = options.input;
    const { repos } = await crawlWorkspace();
    const filtered = repos.filter((r) => !folder || r.workspaceFolderName === folder);
    if (filtered.length === 0) {
      return textResult(
        folder ? `No repos declared in ${folder}'s .specmesh.yml.` : "No repos declared in any workspace folder's .specmesh.yml."
      );
    }
    const lines = filtered.map(
      (r) => `- [${r.workspaceFolderName}] ${r.name} -- ${r.path} (${r.present ? "present" : "NOT PRESENT"}) <- ${r.remote}`
    );
    return textResult(`${filtered.length} declared repo(s):\n${lines.join("\n")}`);
  }
}

interface GetDocLinksInput {
  path: string;
}

class GetDocLinksTool implements vscode.LanguageModelTool<GetDocLinksInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetDocLinksInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const target = options.input.path.replace(/\\/g, "/").toLowerCase();
    const { nodes } = await crawlWorkspace();
    const matches = nodes.filter((n) => {
      const rel = n.relativePath.toLowerCase();
      const abs = n.absolutePath.replace(/\\/g, "/").toLowerCase();
      return rel === target || rel.endsWith("/" + target) || abs === target || abs.endsWith("/" + target);
    });

    if (matches.length === 0) {
      return textResult(`No tracked doc matched "${options.input.path}". Use specmesh_list_docs to find the exact path.`);
    }
    if (matches.length > 1) {
      const lines = matches.map((n) => `- [${n.workspaceFolderName}] ${n.relativePath}`);
      return textResult(`Multiple docs matched "${options.input.path}", be more specific:\n${lines.join("\n")}`);
    }

    const node = matches[0];
    if (node.links.length === 0) {
      return textResult(`${node.relativePath} (${node.workspaceFolderName}) has no outgoing markdown links.`);
    }
    const lines = node.links.map((l) => `- "${l.text}" -> ${l.rawTarget} [${l.exists ? "resolves" : "BROKEN"}]`);
    return textResult(`${node.relativePath} (${node.workspaceFolderName}) links to:\n${lines.join("\n")}`);
  }
}

interface UpdateTrackEntryInput {
  folder: string;
  type: string;
  label: string;
  glob: string;
  exclude?: string[];
}

class UpdateTrackEntryTool implements vscode.LanguageModelTool<UpdateTrackEntryInput> {
  constructor(private readonly refresh: () => Promise<void>) {}

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<UpdateTrackEntryInput>
  ): Promise<vscode.PreparedToolInvocation> {
    const { folder, type, glob } = options.input;
    return {
      invocationMessage: `Updating ${folder}/.specmesh.yml`,
      confirmationMessages: {
        title: "Update .specmesh.yml",
        message: new vscode.MarkdownString(
          `Add/update the \`${type}\` entry (glob \`${glob}\`) in **${folder}**'s \`.specmesh.yml\`?\n\n` +
            "This rewrites the whole file from its parsed entries -- any hand-written comments in an existing file won't be preserved."
        ),
      },
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<UpdateTrackEntryInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { folder: folderName, type, label, glob, exclude } = options.input;
    const folder = (vscode.workspace.workspaceFolders ?? []).find((f) => f.name === folderName);
    if (!folder) {
      throw new Error(
        `No open workspace folder named "${folderName}". Use specmesh_list_docs to see valid folder names.`
      );
    }

    const uri = vscode.Uri.joinPath(folder.uri, ".specmesh.yml");
    let track: DocTypeDefinition[];
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const parsed = (parseYaml(Buffer.from(bytes).toString("utf8")) ?? {}) as { track?: DocTypeDefinition[] };
      track = Array.isArray(parsed.track) && parsed.track.length > 0 ? parsed.track : getBuiltinDefaultDocTypes();
    } catch {
      track = getBuiltinDefaultDocTypes();
    }

    const entry: DocTypeDefinition = exclude && exclude.length > 0 ? { type, label, glob, exclude } : { type, label, glob };
    const existingIndex = track.findIndex((d) => d.type === type);
    if (existingIndex >= 0) {
      track[existingIndex] = entry;
    } else {
      track.push(entry);
    }

    const header =
      "# specmesh per-repo config -- last updated by the specmesh_update_track_entry tool.\n" +
      "# Edit freely: add/remove doc types, or add an 'exclude' list to any entry. See specmesh's README for the schema.\n";
    await vscode.workspace.fs.writeFile(uri, Buffer.from(header + stringifyYaml({ track }), "utf8"));

    await this.refresh();

    return textResult(`Updated ${folder.name}/.specmesh.yml: "${type}" now tracks "${glob}".`);
  }
}

class GetHelpTool implements vscode.LanguageModelTool<Record<string, never>> {
  constructor(private readonly extensionUri: vscode.Uri) {}

  async invoke(): Promise<vscode.LanguageModelToolResult> {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(this.extensionUri, "README.md"));
    return textResult(Buffer.from(bytes).toString("utf8"));
  }
}

export function registerSpecmeshTools(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>
): vscode.Disposable[] {
  return [
    vscode.lm.registerTool("specmesh_list_docs", new ListDocsTool()),
    vscode.lm.registerTool("specmesh_find_broken_links", new FindBrokenLinksTool()),
    vscode.lm.registerTool("specmesh_find_orphans", new FindOrphansTool()),
    vscode.lm.registerTool("specmesh_find_missing_docs", new FindMissingDocsTool()),
    vscode.lm.registerTool("specmesh_get_doc_links", new GetDocLinksTool()),
    vscode.lm.registerTool("specmesh_list_repos", new ListReposTool()),
    vscode.lm.registerTool("specmesh_update_track_entry", new UpdateTrackEntryTool(refresh)),
    vscode.lm.registerTool("specmesh_get_help", new GetHelpTool(context.extensionUri)),
  ];
}
