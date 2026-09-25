import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { crawlPaths, WorkspaceRoot } from "../crawler/crawlNode";
import { computeProblems } from "../crawler/graph";
import { getBuiltinDefaultDocTypes } from "../crawler/docTypesCore";
import { loadRepoConfigFromPath, mergeTrackEntry } from "../crawler/repoConfigCore";
import { DocTypeDefinition } from "../model/types";
import * as docQueries from "../queries/docQueries";

/** Registers the same 8 tools as `specmeshTools.ts`'s `registerSpecmeshTools`, over MCP instead of
 * `vscode.lm.registerTool` -- sharing the same pure query/formatting logic (`docQueries.ts`) and the same
 * `crawlPaths`/Node-fs config helpers used by the standalone (non-VS-Code) MCP server. */
export function registerAllTools(server: McpServer, roots: WorkspaceRoot[]): void {
  const folderShape = {
    folder: z.string().optional().describe("Restrict to this workspace folder name."),
  };

  server.registerTool(
    "specmesh_list_docs",
    {
      description:
        "Lists docs tracked by specmesh across the configured roots (charter/epic/ADR/reference/FR spec-plan-tasks-walkthrough/instructions/skill, plus any repo-specific types from .specmesh.yml). Use to find a doc by title, type, or repo before reading or editing it. Supports optional folder/type/query filters; query matches title or file path substrings.",
      inputSchema: {
        ...folderShape,
        type: z.string().optional().describe("Restrict to this doc type, e.g. 'adr', 'reference', 'fr-spec', 'instructions', 'skill'."),
        query: z.string().optional().describe("Case-insensitive substring to match against the doc's title or file path."),
      },
    },
    async ({ folder, type, query }) => {
      const { nodes } = await crawlPaths(roots);
      return textResult(docQueries.listDocs(nodes, { folder, type, query }));
    }
  );

  server.registerTool(
    "specmesh_find_broken_links",
    {
      description:
        "Finds relative markdown links in specmesh-tracked docs (including cross-repo links between the configured roots) that don't resolve to an existing file. Use to answer 'are there broken links' or before trusting a doc's links.",
      inputSchema: folderShape,
    },
    async ({ folder }) => {
      const { nodes } = await crawlPaths(roots);
      return textResult(docQueries.findBrokenLinks(computeProblems(nodes), folder));
    }
  );

  server.registerTool(
    "specmesh_find_orphans",
    {
      description:
        "Finds ADRs/reference docs/FR specs that no other tracked doc links to (charter/epic docs are legitimate roots and excluded). Use to answer 'which docs are unreferenced/orphaned'.",
      inputSchema: folderShape,
    },
    async ({ folder }) => {
      const { nodes } = await crawlPaths(roots);
      return textResult(docQueries.findOrphans(computeProblems(nodes), folder));
    }
  );

  server.registerTool(
    "specmesh_find_missing_docs",
    {
      description:
        "Finds literal (wildcard-free) .specmesh.yml track entries (e.g. a specific docs/charter.md) whose file no longer exists. Use to answer 'is anything specmesh expects missing'.",
      inputSchema: folderShape,
    },
    async ({ folder }) => {
      const { missingProblems } = await crawlPaths(roots);
      return textResult(docQueries.findMissingDocs(missingProblems, folder));
    }
  );

  server.registerTool(
    "specmesh_get_doc_links",
    {
      description:
        "Returns the outgoing markdown links (text, target, whether it resolves) for one specmesh-tracked doc, identified by a relative or absolute file path. Use after specmesh_list_docs to inspect what a specific doc links to.",
      inputSchema: {
        path: z.string().describe("Relative (e.g. 'docs/adr/ADR-004-....md') or absolute path of the tracked doc."),
      },
    },
    async ({ path: targetPath }) => {
      const { nodes } = await crawlPaths(roots);
      return textResult(docQueries.getDocLinks(nodes, targetPath));
    }
  );

  server.registerTool(
    "specmesh_list_repos",
    {
      description:
        "Lists child repos declared via a .specmesh.yml 'repos' list (name, remote, relative path, and whether the path currently exists on disk). Use to answer 'which repos make up this workspace' or 'is a declared repo missing/not cloned yet'.",
      inputSchema: folderShape,
    },
    async ({ folder }) => {
      const { repos } = await crawlPaths(roots);
      return textResult(docQueries.listRepos(repos, folder));
    }
  );

  server.registerTool(
    "specmesh_update_track_entry",
    {
      description:
        "Adds or replaces one doc-type entry in a workspace folder's .specmesh.yml 'track' list (creating the file, seeded from specmesh's built-in defaults, if it doesn't exist yet). Use when a repo needs a new/changed tracked doc type or glob, or an 'exclude' pattern. Rewrites the whole file from parsed entries, so pre-existing comments in that file are not preserved.",
      inputSchema: {
        folder: z.string().describe("The workspace folder name whose .specmesh.yml to update."),
        type: z.string().describe("Doc type id, e.g. 'adr', 'charter', or a custom type name."),
        label: z.string().describe("Human-readable category label shown in the Docs tree, e.g. 'ADRs'."),
        glob: z
          .string()
          .describe(
            "Glob relative to the folder root, e.g. 'docs/adr/ADR-*.md'. Wildcard-free globs are treated as one expected file and flagged 'missing' if absent."
          ),
        exclude: z
          .array(z.string())
          .optional()
          .describe("Optional glob(s) relative to the folder root to exclude from this entry's matches."),
      },
    },
    async ({ folder: folderName, type, label, glob, exclude }) => {
      const root = roots.find((r) => r.name === folderName);
      if (!root) {
        throw new Error(`No configured root named "${folderName}". Use specmesh_list_docs to see valid folder names.`);
      }

      const repoConfig = await loadRepoConfigFromPath(root.path);
      let track: DocTypeDefinition[] = repoConfig.track ?? getBuiltinDefaultDocTypes();
      track = mergeTrackEntry(track, { type, label, glob, exclude });

      const { stringify: stringifyYaml } = await import("yaml");
      const header =
        "# specmesh per-repo config -- last updated by the specmesh_update_track_entry tool.\n" +
        "# Edit freely: add/remove doc types, or add an 'exclude' list to any entry. See specmesh's README for the schema.\n";
      await fs.promises.writeFile(path.join(root.path, ".specmesh.yml"), header + stringifyYaml({ track }), "utf8");

      return textResult(`Updated ${root.name}/.specmesh.yml: "${type}" now tracks "${glob}".`);
    }
  );

  server.registerTool(
    "specmesh_get_help",
    {
      description:
        "Returns specmesh's own README (what it is, doc types/defaults, .specmesh.yml schema and examples, scaffold command, tree icon legend, settings, commands). Use whenever a question is about how specmesh itself works, its conventions, or its configuration, before guessing.",
      inputSchema: {},
    },
    async () => {
      const readme = await fs.promises.readFile(path.join(__dirname, "..", "..", "README.md"), "utf8");
      return textResult(readme);
    }
  );
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
