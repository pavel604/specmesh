const TITLE_RE = /^#\s+(.+)$/;
const META_RE = /^\*\*([^*]+)\*\*:?\s*(.*)$/;

export interface FrontMatter {
  title: string;
  metadata: Record<string, string>;
}

/**
 * Docs in this convention don't use YAML front-matter; they use a leading
 * "# Title" line followed by "**Key**: value" lines up until the first "## " heading.
 */
export function parseFrontMatter(content: string): FrontMatter {
  const lines = content.split(/\r?\n/);
  let title = "";
  const metadata: Record<string, string> = {};

  for (const line of lines) {
    if (!title) {
      const titleMatch = line.match(TITLE_RE);
      if (titleMatch) {
        title = titleMatch[1].trim();
        continue;
      }
    }
    if (/^##\s+/.test(line)) {
      break;
    }
    const metaMatch = line.match(META_RE);
    if (metaMatch) {
      metadata[metaMatch[1].trim()] = metaMatch[2].trim();
    }
  }

  return { title, metadata };
}
