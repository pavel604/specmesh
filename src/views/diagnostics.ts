import * as vscode from "vscode";
import { Problem } from "../model/types";

export function applyDiagnostics(collection: vscode.DiagnosticCollection, problems: Problem[]): void {
  collection.clear();
  const byFile = new Map<string, vscode.Diagnostic[]>();

  for (const problem of problems) {
    if (problem.kind !== "broken-link" || problem.lineIndex === undefined) {
      continue;
    }
    const range = new vscode.Range(
      problem.lineIndex,
      problem.startCol ?? 0,
      problem.lineIndex,
      problem.endCol ?? 0
    );
    const diagnostic = new vscode.Diagnostic(range, problem.message, vscode.DiagnosticSeverity.Warning);
    diagnostic.source = "specmesh";

    const list = byFile.get(problem.absolutePath) ?? [];
    list.push(diagnostic);
    byFile.set(problem.absolutePath, list);
  }

  for (const [file, diags] of byFile) {
    collection.set(vscode.Uri.file(file), diags);
  }
}
