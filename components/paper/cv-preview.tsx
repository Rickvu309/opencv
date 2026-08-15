"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import type { CvPaper } from "@/lib/paper/types";
import { PAGE_WIDTH, CvDocument } from "./cv-document";

/**
 * The A4 page, scaled to whatever width the pane happens to be.
 *
 * The scale comes from a `ResizeObserver` rather than a media query, because
 * this pane is resizable: the sidebar drags, the window resizes, and the
 * inspector opens beside it. The observer fires once on `observe`, so the first
 * paint is already at the right size and there is no `setState` in the effect
 * body to cascade a render.
 */
export function CvPreview({ cv }: { cv: CvPaper }) {
  const paneRef = React.useRef<HTMLDivElement>(null);
  const pageRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  // The page's own height at full size. A CV longer than one A4 page grows,
  // and the wrapper below has to grow with it.
  const [pageHeight, setPageHeight] = React.useState(0);

  React.useEffect(() => {
    const pane = paneRef.current;
    const page = pageRef.current;
    if (!pane || !page) return;

    const paneObserver = new ResizeObserver(([entry]) => {
      // Never scale up: a CV blown past 100% is just blurry, and the point of
      // the preview is to show the reader's view, not to fill the pane.
      setScale(Math.min(1, entry.contentRect.width / PAGE_WIDTH));
    });
    const pageObserver = new ResizeObserver(([entry]) => {
      setPageHeight(entry.contentRect.height);
    });
    paneObserver.observe(pane);
    pageObserver.observe(page);
    return () => {
      paneObserver.disconnect();
      pageObserver.disconnect();
    };
  }, []);

  return (
    <div ref={paneRef} className="w-full">
      {/* `transform` does not affect layout, so the scaled page would otherwise
          reserve its full unscaled height and leave a long empty tail below. */}
      <div style={{ height: pageHeight * scale }}>
        <div
          ref={pageRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: PAGE_WIDTH,
          }}
          className="shadow-md ring-1 ring-black/10"
        >
          <CvDocument cv={cv} />
        </div>
      </div>
    </div>
  );
}

/**
 * A second copy of the document, mounted on `document.body`, that only exists
 * when the print stylesheet says so.
 *
 * Printing the preview in place does not work: the app shell is `h-svh
 * overflow-hidden` with nested scroll panes, and every one of those ancestors
 * clips the page to one screenful. Rather than fight them with `!important`
 * overrides that break the next time the shell changes, this puts the document
 * where nothing is above it.
 *
 * The host element is made during render but attached in an effect, so there is
 * no `setState` to cascade and the server renders nothing at all.
 */
export function CvPrintPortal({ cv }: { cv: CvPaper }) {
  const host = React.useMemo(
    () =>
      typeof document === "undefined" ? null : document.createElement("div"),
    [],
  );

  React.useEffect(() => {
    if (!host) return;
    host.setAttribute("data-print-portal", "");
    document.body.append(host);
    return () => host.remove();
  }, [host]);

  if (!host) return null;
  return createPortal(<CvDocument cv={cv} print />, host);
}
