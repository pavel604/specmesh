const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const FENCE_RE = /^\s*```/;
const INLINE_CODE_RE = /`[^`\n]+`/g;

export interface RawLink {
  text: string;
  target: string;
  lineIndex: number;
  startCol: number;
  endCol: number;
}

/** Returns the [start, end) ranges of the line covered by single-backtick inline code spans. */
function inlineCodeRanges(line: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  INLINE_CODE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_CODE_RE.exec(line))) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

/**
 * Extracts markdown links, skipping external URLs, same-file anchor-only links, fenced code blocks, and links
 * inside inline code spans (backticks suppress markdown link parsing, so these aren't real links either).
 */
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

    const codeRanges = inlineCodeRanges(line);

    LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINK_RE.exec(line))) {
      if (codeRanges.some(([start, end]) => match!.index >= start && match!.index < end)) {
        continue;
      }

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
