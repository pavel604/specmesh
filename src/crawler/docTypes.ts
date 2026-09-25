import * as vscode from "vscode";
import { DocTypeDefinition } from "../model/types";
import { DEFAULT_DOC_TYPES } from "./docTypesCore";

export { getBuiltinDefaultDocTypes } from "./docTypesCore";

export function getDocTypeDefinitions(): DocTypeDefinition[] {
  const configured = vscode.workspace
    .getConfiguration("specmesh")
    .get<DocTypeDefinition[]>("docTypes");
  return configured && configured.length > 0 ? configured : DEFAULT_DOC_TYPES;
}
