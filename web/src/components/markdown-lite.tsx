"use client";
import React from "react";

/**
 * Minimal, dependency-free renderer for the constrained Markdown subset our
 * own prompts produce (see api/ask-nhrc/route.ts's system prompt): "## "
 * headings, "- " bullets, "> " blockquotes, "**bold**", "[n]" citation
 * markers, and (only when the model decides a comparison calls for one) a
 * standard pipe table. Not a general Markdown parser - just enough
 * structure to render the fourcorners.law-style "summary -> per-source
 * sections -> citations" answer format instead of one flat paragraph of
 * plain text.
 */

// "| a | b |" or "a | b" (bare form is also common model output) - a table
// row needs at least one "|" to distinguish it from ordinary prose that
// happens to contain a lone pipe character.
const TABLE_ROW = /\|/;
// The separator row Markdown tables require right after the header, e.g.
// "|---|:--:|---|" - only cell content made of dashes/colons/spaces.
const TABLE_SEPARATOR = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    // A table is a header row immediately followed by a valid separator row
    // ("|---|---|") - checking the separator, not just "line has a pipe", is
    // what tells a real table apart from prose that happens to contain one.
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1].trim())) {
      flushPara();
      flushList();
      const headerCells = splitTableRow(line);
      const bodyRows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && TABLE_ROW.test(lines[j].trim()) && lines[j].trim() !== "") {
        bodyRows.push(splitTableRow(lines[j]));
        j++;
      }
      const tableKey = key++;
      blocks.push(
        <div key={`tbl-wrap-${tableKey}`} className="cw-answer-table-wrap">
          <table className="cw-answer-table">
            <thead>
              <tr>
                {headerCells.map((cell, ci) => (
                  <th key={ci}>{renderInline(cell, onCiteClick, `th${tableKey}-${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderInline(cell, onCiteClick, `td${tableKey}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j - 1; // outer loop's i++ then lands on the first line after the table
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
