"use client";

// The paper the Coach just touched, shown where it was touched.

import * as React from "react";
import { Link } from "@/lib/nav";
import { ExternalLink } from "lucide-react";

import { CvDocument, PAGE_WIDTH } from "@/components/paper/cv-document";
import { useAppState } from "@/lib/actions/store";
import {
  cvCompleteness,
  isCvPaper,
  isLetterPaper,
  isProofPaper,
  paperTypeLabels,
  wordForTemplate,
  type Paper,
} from "@/lib/paper";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/** A successful `paper.*` call, reduced to what this component needs. */
export type CvPaperEdit = {
  action?: string;
  input?: Record<string, unknown>;
};

function resolvePaperId(
  edits: readonly CvPaperEdit[],
  papers: readonly Paper[],
): string | undefined {
  const ids = new Set(papers.map((item) => item.id));
  for (const edit of edits) {
    const id = edit.input?.id;
    if (typeof id === "string" && ids.has(id)) return id;
  }

  const minted = edits.some(
    (e) => e.action === "paper.create" || e.action === "paper.duplicate",
  );
  if (!minted) return undefined;

  return papers.at(-1)?.id;
}

export function CvArtifact({
  edits,
  compact,
}: {
  edits: readonly CvPaperEdit[];
  compact?: boolean;
}) {
  const { paper } = useAppState();
  const { t, m } = useT();
  const paperId = resolvePaperId(edits, paper);
  const current = paper.find((item) => item.id === paperId);

  const frameRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0);

  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / PAGE_WIDTH);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [current]);

  if (!current) return null;

  const typeWord = isCvPaper(current)
    ? wordForTemplate(current.theme.template)
    : t(paperTypeLabels[current.type]);
  const completeness = isCvPaper(current) ? cvCompleteness(current) : null;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {current.label || typeWord}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{typeWord}</span>
        {completeness !== null && (
          <span
            aria-label={t(m.paper.cv.completeness)}
            className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
          >
            {completeness}%
          </span>
        )}
        <Link
          href={`/paper?id=${encodeURIComponent(current.id)}`}
          aria-label={t(m.coach.openPaper)}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      {isCvPaper(current) ? (
        <div
          ref={frameRef}
          aria-hidden
          className={cn("overflow-hidden bg-muted/30", compact ? "h-40" : "h-56")}
        >
          <div
            style={{
              width: PAGE_WIDTH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              visibility: scale > 0 ? "visible" : "hidden",
            }}
          >
            <CvDocument cv={current} print />
          </div>
        </div>
      ) : (
        <div className={cn("bg-muted/30 px-3 py-3", compact ? "h-40" : "h-56")}>
          {isLetterPaper(current) && (
            <p className="line-clamp-6 whitespace-pre-wrap text-xs text-muted-foreground">
              {current.body || t(m.paper.letter.emptyDocument)}
            </p>
          )}
          {isProofPaper(current) && (
            <p className="line-clamp-6 whitespace-pre-wrap text-xs text-muted-foreground">
              {current.notes[0]?.text || t(m.paper.proof.emptyTitle)}
            </p>
          )}
        </div>
      )}

      <p className="sr-only">
        {current.label} — {typeWord}
      </p>
    </div>
  );
}
