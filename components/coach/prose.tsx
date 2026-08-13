"use client";

// How the Coach's words are drawn, wherever they appear.
//
// Extracted from thread-view because the reasoning panel renders the same kind
// of text as the reply, and the two must not drift: the model writes one voice
// and one flavour of markdown, so one renderer.
//
// AI Elements ships `ReasoningContent` wired to Streamdown, which brings a full
// markdown pipeline plus mermaid, KaTeX and syntax highlighting — 580KB to draw
// paragraphs and bullet lists for a careers app that emits neither diagrams nor
// equations. `parseProse` already handles exactly the subset this model
// produces, and it was written against a real production reply that the naive
// version mangled. So the AI Elements component keeps its state machine and
// gets this for its body instead.

import * as React from "react";

import { parseProse } from "@/lib/coach/messages";

/** `**bold**` and `*emphasis*`, the small subset the coach actually emits. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-medium text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function CoachProse({ content }: { content: string }) {
  return (
    <div className="space-y-4">
      {parseProse(content).map((block, i) => {
        if (block.kind === "bullets") {
          return (
            <ul key={i} className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2.5 size-1 shrink-0 rounded-full bg-muted-foreground/60"
                  />
                  <span className="min-w-0 flex-1">{inline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === "numbered") {
          return (
            <ol key={i} className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3">
                  <span className="w-4 shrink-0 text-right font-medium tabular-nums text-muted-foreground">
                    {item.marker}
                  </span>
                  <span className="min-w-0 flex-1">{inline(item.text)}</span>
                </li>
              ))}
            </ol>
          );
        }
        // A single newline inside a paragraph is a line break the Coach meant,
        // not whitespace to collapse.
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {inline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
