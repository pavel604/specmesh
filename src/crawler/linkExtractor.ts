const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

export interface RawLink {
  text: string;
  target: string;
  lineIndex: number;
  startCol: number;
  endCol: number;
}

/** Extracts markdown links, skipping external URLs and same-file anchor-only links. */
export function extractMarkdownLinks(content: string): RawLink[] {
  const lines = content.split(/\r?\n/);
  const links: RawLink[] = [];

  lines.forEach((line, lineIndex) => {
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
