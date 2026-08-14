"use client";

// The CV the Coach just touched, shown where it was touched.
//
// Editing a CV through the chat used to end with a sentence saying it was done
// and a chip saying which action ran. To see the result you left the
// conversation, went to /cv, and found the change — or didn't, and had no way
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

import { ResumeDocument, PAGE_WIDTH } from "@/components/cv/resume-document";
import { useAppState } from "@/lib/actions/store";
import { resumeCompleteness } from "@/lib/cv/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/** A successful `resume.*` call, reduced to what this component needs. */
export type ResumeEdit = {
  action?: string;
  input?: Record<string, unknown>;
};

/**
 * Which CV a turn's edits landed on.
 *
 * Most `resume.*` actions name their target: `resumeId` on the ones that edit
 * a section or an entry, `id` on the ones that act on the document itself.
 * Section and entry ids are `sec-N` and `ent-N`, so requiring the `cv-` prefix
 * keeps those from being mistaken for a document.
 *
 * `resume.create` and `resume.duplicate` are the exception and the case that
 * matters most, because building someone their first CV is the whole feature.
 * Their id is minted inside the reducer, so it appears in no payload. The newly
 * made document is the one with the highest `cv-N`, and it was made moments ago
 * by the call we are looking at, so that is what gets shown.
 */
function resolveResumeId(
  edits: readonly ResumeEdit[],
  resumes: readonly { id: string }[],
): string | undefined {
  for (const edit of edits) {
    const id = edit.input?.resumeId ?? edit.input?.id;
    if (typeof id === "string" && id.startsWith("cv-")) return id;
  }

  const minted = edits.some(
    (e) => e.action === "resume.create" || e.action === "resume.duplicate",
  );
  if (!minted) return undefined;

  return resumes
    .map((r) => r.id)
    .filter((id) => /^cv-\d+$/.test(id))
    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))
    .at(-1);
}

/**
 * A live thumbnail of one CV.
 *
 * Reads from the store rather than from the tool result, so it shows the
 * document as it is *now*: if the user edits a line on /cv while the panel is
 * open, or the Coach makes three changes in one turn, this follows. A snapshot
 * taken at tool time would go stale inside the same conversation.
 */
export function ResumeArtifact({
  edits,
  compact,
}: {
  edits: readonly ResumeEdit[];
  compact?: boolean;
}) {
  const { resumes } = useAppState();
  const { t, m, locale } = useT();
  const resumeId = resolveResumeId(edits, resumes);
  const resume = resumes.find((r) => r.id === resumeId);

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

  const completeness = resumeCompleteness(resume);

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
          href={`/cv?resume=${encodeURIComponent(resume.id)}`}
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
        {resume.sections.filter((s) => !s.hidden).length} {locale === "vi" ? "mục" : "sections"}
      </p>
    </div>
  );
}
