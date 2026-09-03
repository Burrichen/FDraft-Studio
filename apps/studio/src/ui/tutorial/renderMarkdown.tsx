import { Fragment, type ReactNode } from "react";

/**
 * A minimal, dependency-free Markdown-to-JSX pass — headings, paragraphs,
 * and `- `/`* ` bullet lists only, which is all `USER_GUIDE.md`/
 * `TROUBLESHOOTING.md` actually use. Deliberately not a general Markdown
 * renderer: these two bundled files are the only content this ever
 * shows, so matching exactly what they use is enough, and avoids adding
 * a new dependency for two short offline documents.
 *
 * Never throws, regardless of input — empty, whitespace-only, or
 * otherwise malformed content (e.g. a bundled asset that failed to
 * inline correctly) renders as an empty or partial document rather than
 * crashing the tutorial. See `renderMarkdown.test.ts`.
 */
export function renderMarkdown(raw: string): ReactNode {
  const lines = raw.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList(key: string): void {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={key}>
        {listItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  lines.forEach((line, i) => {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flushList(`list-${i}`);
      const level = heading[1]!.length;
      const text = heading[2]!;
      if (level === 1) blocks.push(<h2 key={i}>{text}</h2>);
      else if (level === 2) blocks.push(<h3 key={i}>{text}</h3>);
      else blocks.push(<h4 key={i}>{text}</h4>);
    } else if (bullet) {
      listItems.push(bullet[1]!);
    } else if (line.trim().length === 0) {
      flushList(`list-${i}`);
    } else {
      flushList(`list-${i}`);
      blocks.push(<p key={i}>{line}</p>);
    }
  });
  flushList("list-end");
  return <Fragment>{blocks}</Fragment>;
}
