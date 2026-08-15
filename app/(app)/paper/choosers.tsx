"use client";

import * as React from "react";

import { templateHasPhoto, templates, wordForTemplate } from "@/lib/paper/cv";
import {
  letterSituations,
  type CvTemplate,
  type LetterSituation,
} from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export function CvGallery({
  onPick,
  onBack,
  current,
}: {
  onPick: (template: CvTemplate) => void;
  onBack: () => void;
  current?: CvTemplate;
}) {
  const { t, m } = useT();
  const labels: Record<CvTemplate, string> = {
    classic: t(m.paper.cv.templateClassic),
    internship: t(m.paper.cv.templateInternship),
    academic: t(m.paper.cv.templateAcademic),
    service: t(m.paper.cv.templateService),
    compact: t(m.paper.cv.templateCompact),
    modern: t(m.paper.cv.templateModern),
    technical: t(m.paper.cv.templateTechnical),
    design: t(m.paper.cv.templateDesign),
  };
  const [focus, setFocus] = React.useState(() =>
    current ? Math.max(0, templates.indexOf(current)) : 0,
  );
  const tileRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    tileRefs.current[focus]?.focus();
  }, [focus]);

  const move = (delta: number) => {
    setFocus((i) => {
      const next = i + delta;
      if (next < 0 || next >= templates.length) return i;
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ul
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              move(1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              move(-1);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              move(window.matchMedia("(min-width: 768px)").matches ? 4 : 2);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              move(window.matchMedia("(min-width: 768px)").matches ? -4 : -2);
            } else if (event.key === "Escape") {
              event.preventDefault();
              onBack();
            }
          }}
        >
          {templates.map((template, index) => (
            <li key={template}>
              <button
                ref={(node) => {
                  tileRefs.current[index] = node;
                }}
                type="button"
                tabIndex={index === focus ? 0 : -1}
                onClick={() => onPick(template)}
                onFocus={() => setFocus(index)}
                className={cn(
                  "flex w-full flex-col text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
              >
                <span
                  className={cn(
                    "block w-full bg-white ring-1 ring-foreground/15",
                    current === template && "ring-foreground",
                    "hover:ring-foreground",
                  )}
                  style={{
                    aspectRatio: "1 / 1.414",
                    ...(current === template
                      ? { viewTransitionName: "paper-gallery-pick" }
                      : {}),
                  }}
                >
                  <TemplateMark template={template} />
                </span>
                <span className="mt-2 text-pretty text-sm font-medium">
                  {labels[template]}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {wordForTemplate(template)}
                  {templateHasPhoto(template) ? (
                    <>
                      <span aria-hidden> · </span>
                      {t(m.paper.includesPhoto)}
                    </>
                  ) : null}
                </span>
                {template === "design" && (
                  <span className="mt-1 text-pretty text-xs text-muted-foreground">
                    {t(m.paper.cv.templateDesignHint)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TemplateMark({ template }: { template: CvTemplate }) {
  const photo = templateHasPhoto(template);
  const twoCol =
    template === "modern" || template === "technical" || template === "design";

  return (
    <span
      aria-hidden
      className="flex h-full w-full flex-col gap-[6%] bg-white p-[10%] text-black"
    >
      {template === "design" && (
        <span className="h-[2%] w-full bg-black/70" />
      )}
      <span className="flex gap-[4%]">
        {photo && (
          <span className="aspect-square w-[18%] shrink-0 bg-black/15" />
        )}
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-[8%]">
          <span className="h-[8%] w-3/4 bg-black/55" />
          <span className="h-[6%] w-1/2 bg-black/25" />
        </span>
      </span>
      <span
        className={cn(
          "mt-auto grid gap-[6%]",
          twoCol && "grid-cols-2",
        )}
      >
        <span className="h-1.5 bg-black/20" />
        <span className="h-1.5 bg-black/20" />
        <span className="h-1.5 bg-black/20" />
        {twoCol && <span className="h-1.5 bg-black/20" />}
      </span>
    </span>
  );
}

export function LetterChooser({
  onPick,
}: {
  onPick: (
    situation: LetterSituation,
    extras: { role?: string; org?: string },
  ) => void;
  onBack: () => void;
}) {
  const { t, m } = useT();

  const labels: Record<LetterSituation, string> = {
    posted: t(m.paper.letter.situationPosted),
    internship: t(m.paper.letter.situationInternship),
    speculative: t(m.paper.letter.situationSpeculative),
    scholarship: t(m.paper.letter.situationScholarship),
  };
  const hints: Record<LetterSituation, string> = {
    posted: t(m.paper.letter.situationPostedHint),
    internship: t(m.paper.letter.situationInternshipHint),
    speculative: t(m.paper.letter.situationSpeculativeHint),
    scholarship: t(m.paper.letter.situationScholarshipHint),
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <ul className="grid gap-3 sm:grid-cols-2">
        {letterSituations.map((item) => (
          <li key={item}>
            <button
              type="button"
              onClick={() => onPick(item, {})}
              className="flex h-full w-full flex-col rounded-lg border bg-card p-4 text-start outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-pretty text-sm font-medium">
                {labels[item]}
              </span>
              <span className="mt-1 text-pretty text-xs text-muted-foreground">
                {hints[item]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
