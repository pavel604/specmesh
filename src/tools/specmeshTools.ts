import * as vscode from "vscode";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { crawlWorkspace } from "../crawler/crawler";
import { computeProblems } from "../crawler/graph";
import { getBuiltinDefaultDocTypes } from "../crawler/docTypes";
import { mergeTrackEntry } from "../crawler/repoConfig";
import { DocTypeDefinition } from "../model/types";
import * as docQueries from "../queries/docQueries";

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
    const { nodes } = await crawlWorkspace();
    return textResult(docQueries.listDocs(nodes, options.input));
  }
}

class FindBrokenLinksTool implements vscode.LanguageModelTool<FolderFilterInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FolderFilterInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { nodes } = await crawlWorkspace();
    return textResult(docQueries.findBrokenLinks(computeProblems(nodes), options.input.folder));
  }
}

class FindOrphansTool implements vscode.LanguageModelTool<FolderFilterInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FolderFilterInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { nodes } = await crawlWorkspace();
    return textResult(docQueries.findOrphans(computeProblems(nodes), options.input.folder));
  }
}

class FindMissingDocsTool implements vscode.LanguageModelTool<FolderFilterInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FolderFilterInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { missingProblems } = await crawlWorkspace();
    return textResult(docQueries.findMissingDocs(missingProblems, options.input.folder));
  }
}

class ListReposTool implements vscode.LanguageModelTool<FolderFilterInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FolderFilterInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { repos } = await crawlWorkspace();
    return textResult(docQueries.listRepos(repos, options.input.folder));
  }
}

interface GetDocLinksInput {
  path: string;
}

class GetDocLinksTool implements vscode.LanguageModelTool<GetDocLinksInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetDocLinksInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { nodes } = await crawlWorkspace();
    return textResult(docQueries.getDocLinks(nodes, options.input.path));
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

    track = mergeTrackEntry(track, { type, label, glob, exclude });

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
