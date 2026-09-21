export type DocIconKind = "instructions" | "skill" | "doc";

// shared by the tree (icon) and graph (color) views so type distinctions stay visually consistent between them.
export function docIconKind(type: string, fileName: string): DocIconKind {
  if (type === "instructions" || fileName.endsWith(".instructions.md")) {
    return "instructions";
  }
  if (type === "skill" || fileName.toUpperCase() === "SKILL.MD") {
    return "skill";
  }
  return "doc";
}

export function iconForDoc(type: string, fileName: string): string {
  const kind = docIconKind(type, fileName);
  if (kind === "instructions") {
    return "checklist";
  }
  if (kind === "skill") {
    return "tools";
  }
  return "book";
}
