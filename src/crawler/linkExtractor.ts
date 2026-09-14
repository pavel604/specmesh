const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const FENCE_RE = /^\s*```/;

export interface RawLink {
  text: string;
  target: string;
  lineIndex: number;
  startCol: number;
  endCol: number;
}

/** Extracts markdown links, skipping external URLs, same-file anchor-only links, and fenced code blocks. */
export function extractMarkdownLinks(content: string): RawLink[] {
  const lines = content.split(/\r?\n/);
  const links: RawLink[] = [];
  let insideFence = false;

  lines.forEach((line, lineIndex) => {
    if (FENCE_RE.test(line)) {
      insideFence = !insideFence;
      return;
    }
    if (insideFence) {
      return;
    }

    LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINK_RE.exec(line))) {
      const target = match[2].trim();
      if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) {
        continue;
      }
      links.push({
        text: match[1],
        target,
        lineIndex,
        startCol: match.index,
        endCol: match.index + match[0].length,
      });
    }
  });

  return links;
}
