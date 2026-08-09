"use client";
import React from "react";

/**
 * Minimal, dependency-free renderer for the constrained Markdown subset our
 * own prompts produce (see api/ask-nhrc/route.ts's system prompt): "## "
 * headings, "- " bullets, "> " blockquotes, "**bold**", and "[n]" citation
 * markers. Not a general Markdown parser - just enough structure to render
 * the fourcorners.law-style "summary -> per-source sections -> citations"
 * answer format instead of one flat paragraph of plain text.
 */

function renderInline(text: string, onCiteClick?: (n: number) => void, keyPrefix = ""): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let seg = 0;

  const pushPlain = (chunk: string, key: string) => {
    const citeRegex = /\[(\d+)\]/g;
    let li = 0;
    let ci = 0;
    let m: RegExpExecArray | null;
    while ((m = citeRegex.exec(chunk))) {
      if (m.index > li) nodes.push(chunk.slice(li, m.index));
      const n = Number(m[1]);
      nodes.push(
        <sup
          key={`${key}-c${ci++}`}
          className="cw-cite-ref"
          role={onCiteClick ? "button" : undefined}
          onClick={() => onCiteClick?.(n)}
        >
          [{n}]
        </sup>
      );
      li = m.index + m[0].length;
    }
    if (li < chunk.length) nodes.push(chunk.slice(li));
  };

  while ((match = boldRegex.exec(text))) {
    if (match.index > lastIndex) pushPlain(text.slice(lastIndex, match.index), `${keyPrefix}-p${seg++}`);
    nodes.push(<strong key={`${keyPrefix}-b${seg++}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) pushPlain(text.slice(lastIndex), `${keyPrefix}-p${seg++}`);
  return nodes;
}

export function MarkdownLite({ text, onCiteClick }: { text: string; onCiteClick?: (n: number) => void }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer;
    listBuffer = [];
    blocks.push(
      <ul key={`ul-${key++}`} className="cw-answer-list">
        {items.map((item, i) => (
          <li key={i}>{renderInline(item, onCiteClick, `li${key}-${i}`)}</li>
        ))}
      </ul>
    );
  };
  const flushPara = () => {
    if (paraBuffer.length === 0) return;
    const joined = paraBuffer.join(" ");
    paraBuffer = [];
    blocks.push(
      <p key={`p-${key++}`} className="cw-answer-p">
        {renderInline(joined, onCiteClick, `p${key}`)}
      </p>
    );
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      // Tolerant of the model emitting "# " for a top-level line even though
      // the prompt only asks for "## " - treat any 1-2 hash count as the
      // bigger heading style and 3+ as the smaller one, rather than silently
      // rendering a stray "#" as literal text.
      flushPara();
      flushList();
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      if (level <= 2) {
        blocks.push(
          <h3 key={`h3-${key++}`} className="cw-answer-h3">
            {renderInline(content, onCiteClick, `h3-${key}`)}
          </h3>
        );
      } else {
        blocks.push(
          <h4 key={`h4-${key++}`} className="cw-answer-h4">
            {renderInline(content, onCiteClick, `h4-${key}`)}
          </h4>
        );
      }
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      flushPara();
      listBuffer.push(line.slice(2));
    } else if (line.startsWith("> ")) {
      flushPara();
      flushList();
      blocks.push(
        <blockquote key={`bq-${key++}`} className="cw-answer-quote">
          {renderInline(line.slice(2), onCiteClick, `bq-${key}`)}
        </blockquote>
      );
    } else {
      flushList();
      paraBuffer.push(line);
    }
  }
  flushPara();
  flushList();

  return <div className="cw-answer">{blocks}</div>;
}
