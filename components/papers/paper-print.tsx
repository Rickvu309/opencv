"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { paragraphsOf, type ProseDocument } from "@/lib/papers/types";

/**
 * The printable copy of a letter, mounted on `document.body`.
 *
 * Same reason as `ResumePrintPortal`: the app shell is `h-svh overflow-hidden`
 * with nested scroll panes, and every one of those ancestors clips the page to
 * one screenful. Rather than fight them with `!important` overrides that break
 * the next time the shell changes, the document goes where nothing is above it.
 *
 * Deliberately plain. A letter is not laid out; it is typed. What matters on
 * paper is the margin, a readable size, and paragraphs that do not split across
 * a page break in the middle of a sentence.
 */
export function PaperPrintPortal({ paper }: { paper: ProseDocument }) {
  const host = React.useMemo(
    () => (typeof document === "undefined" ? null : document.createElement("div")),
    [],
  );

  React.useEffect(() => {
    if (!host) return;
    host.setAttribute("data-print-portal", "");
    document.body.append(host);
    return () => host.remove();
  }, [host]);

  if (!host) return null;

  return createPortal(
    // Inline styles rather than tokens: this renders on paper, where the theme
    // does not apply and a dark-mode background would be an ink bill.
    <article
      lang={paper.language}
      style={{
        // No `display: none` here. The host carries `data-print-portal`, and
        // `globals.css` hides *that* on screen and reveals it in print. Hiding
        // the article as well looked equivalent and was not: the print rule
        // targets the host, so the host turned back on and the article stayed
        // off, and the PDF came out blank.
        padding: "56px 64px",
        fontFamily: "var(--font-be-vietnam), sans-serif",
        fontSize: 13.5,
        lineHeight: 1.75,
        color: "#111827",
        background: "#fff",
      }}
    >
      {paragraphsOf(paper.body).map((paragraph, index) => (
        <p
          key={index}
          style={{
            margin: index === 0 ? 0 : "0 0 0 0",
            marginTop: index === 0 ? 0 : 14,
            // A paragraph broken across two pages mid-sentence reads as a
            // printing accident, which is not what you want an employer's
            // first impression of you to be.
            breakInside: "avoid",
            whiteSpace: "pre-wrap",
          }}
        >
          {paragraph}
        </p>
      ))}
    </article>,
    host,
  );
}
