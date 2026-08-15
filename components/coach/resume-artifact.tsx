"use client";

// The CV the Coach just touched, shown where it was touched.
//
// Editing a CV through the chat used to end with a sentence saying it was done
// and a chip saying which action ran. To see the result you left the
// conversation, went to /paper, and found the change — or didn't, and had no way
// to tell which. For the one thing in this product that is a *document*, the
// confirmation should be the document.
//
// Deliberately not a docked side panel. `/coach` and the 24rem floating panel
// are two views of one conversation (DESIGN.md), and a layout that only one of
// them can render would split them again. This sits in the thread, so it works
// in both and travels with the message that caused it.

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { ResumeDocument, PAGE_WIDTH } from "@/components/paper/resume-document";
import { useAppState } from "@/lib/actions/store";
import { cvCompleteness, cvsOf, isCvPaper, type Paper } from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/** A successful `paper.*` call, reduced to what this component needs. */
export type CvPaperEdit = {
  action?: string;
  input?: Record<string, unknown>;
};

/**
 * Which CV a turn's edits landed on.
 *
 * Most `paper.*` actions name their target as `id`. Create and duplicate mint
 * the id inside the reducer, so it appears in no payload: the new paper is the
 * last item in `state.paper`, and we only show this thumbnail when that item
 * is a CV.
 *
 * Migrated CVs keep their old ids (`cv-1`); new ones are `paper-N`. Matching
 * against the live list covers both.
 */
function resolveCvId(
  edits: readonly CvPaperEdit[],
  papers: readonly Paper[],
): string | undefined {
  const cvIds = new Set(cvsOf(papers).map((cv) => cv.id));
  for (const edit of edits) {
    const id = edit.input?.id;
    if (typeof id === "string" && cvIds.has(id)) return id;
  }

  const minted = edits.some(
    (e) => e.action === "paper.create" || e.action === "paper.duplicate",
  );
  if (!minted) return undefined;

  const last = papers.at(-1);
  return last && isCvPaper(last) ? last.id : undefined;
}

/**
 * A live thumbnail of one CV.
 *
 * Reads from the store rather than from the tool result, so it shows the
 * document as it is *now*: if the user edits a line on /paper while the panel is
 * open, or the Coach makes three changes in one turn, this follows. A snapshot
 * taken at tool time would go stale inside the same conversation.
 */
export function ResumeArtifact({
  edits,
  compact,
}: {
  edits: readonly CvPaperEdit[];
  compact?: boolean;
}) {
  const { paper } = useAppState();
  const { t, m } = useT();
  const resumeId = resolveCvId(edits, paper);
  const resume = cvsOf(paper).find((r) => r.id === resumeId);

  // The thumbnail is a real render of the real document, scaled to the width it
  // is given, so what it shows is what prints.
  //
  // Measured rather than assumed. A fixed scale looked right in the message
  // column on a wide screen and left the page stranded in the corner of its
  // frame everywhere else — the thread is 46rem on `/coach`, 24rem in the
  // floating panel, and narrower again on a phone. `transform` does not change
  // an element's layout box, so the width has to come from the box that
  // actually got laid out.
  //
  // Above the early return below, and it has to stay there: a CV deleted while
  // this is on screen flips `resume` to undefined, and hooks called after that
  // return would change in number between renders.
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
  }, [resume]);

  // Deleted since, or never existed. Silence is right: the tool chip above has
  // already said what happened, and an empty frame would suggest otherwise.
  if (!resume) return null;

  const completeness = cvCompleteness(resume);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {resume.label}
        </span>
        <span
          aria-label={t(m.cv.completeness)}
          className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
        >
          {completeness}%
        </span>
        <Link
          href={`/paper?id=${encodeURIComponent(resume.id)}`}
          aria-label={t(m.coach.openCv)}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      {/* Clipped to the first stretch of the page: this is a glance, not the
          editor. The height is the scaled width times the A4 ratio, so the crop
          lands in the same place whatever the CV contains. */}
      <div
        ref={frameRef}
        aria-hidden
        className={cn("overflow-hidden bg-muted/30", compact ? "h-40" : "h-56")}
      >
        <div
          // Hidden until measured: rendering at scale 1 for a frame flashes a
          // full-size A4 page across the conversation before it snaps down.
          style={{
            width: PAGE_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            visibility: scale > 0 ? "visible" : "hidden",
          }}
        >
          <ResumeDocument resume={resume} print />
        </div>
      </div>

      {/* The screen-reader path. The thumbnail above is decorative because a
          scaled-down document read aloud in full is worse than useless; this
          says what it is and where to go to read it. */}
      <p className="sr-only">
        {resume.label} — {resume.header.name},{" "}
        {resume.sections.filter((s) => !s.hidden).length} sections
      </p>
    </div>
  );
}
