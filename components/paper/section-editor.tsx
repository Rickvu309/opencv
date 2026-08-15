"use client";

// One section of a CV, and the entries inside it.
//
// Every control here dispatches through lib/actions, so anything the user can
// do on this screen the Coach can do through `apply_action`, and vice versa.
// That is the whole reason the registry has granular `paper.*` actions rather
// than one `paper.set`.

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDispatch, useTouched } from "@/lib/actions/store";
import { isProseKind, sectionDefaults, type CvSection } from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { disclose, discloseInner } from "@/components/ui/disclose";
import { cn } from "@/lib/utils";
import { DraftInput, DraftTextarea } from "./draft-field";

export function SectionEditor({
  resumeId,
  section,
  isFirst,
  isLast,
}: {
  resumeId: string;
  section: CvSection;
  isFirst: boolean;
  isLast: boolean;
}) {
  const dispatch = useDispatch();
  const touched = useTouched();
  const { t, m } = useT();
  const [open, setOpen] = React.useState(true);
  const prose = isProseKind(section.kind);
  // The hint is interface copy. The heading is document content.
  const hint = sectionDefaults[section.kind].hint;

  const update = (fields: Record<string, unknown>) =>
    dispatch("paper.updateSection", { id: resumeId, sectionId: section.id, ...fields }, { silent: true });

  return (
    <section
      id={`sec-${section.id}`}
      aria-labelledby={`sec-label-${section.id}`}
      className={cn(
        "scroll-mt-3",
        section.hidden && "opacity-60",
        touched.includes(section.id) && "animate-just-changed",
      )}
    >
      {/* The heading is a heading and the input is an input. Nesting the input
          inside the `h3` made the heading's accessible name the input's too,
          so a screen reader announced "Tên mục: Giới thiệu Giới thiệu". */}
      <h3 id={`sec-label-${section.id}`} className="sr-only">
        {section.heading}
      </h3>

      <div className="flex items-center gap-1 border-b border-border py-2 pe-2 ps-4">
        <DraftInput
          id={`heading-${section.id}`}
          label={t(m.cv.sectionName)}
          srLabel
          value={section.heading}
          onCommit={(heading) => heading && update({ heading })}
          className="min-w-0 flex-1 [&_input]:h-7 [&_input]:border-transparent [&_input]:bg-transparent [&_input]:px-1.5 [&_input]:text-sm [&_input]:font-medium [&_input]:shadow-none [&_input:hover]:bg-muted/60"
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={t(
                section.hidden
                  ? m.cv.showSection(section.heading)
                  : m.cv.hideSection(section.heading),
              )}
              onClick={() => update({ hidden: !section.hidden })}
            >
              {section.hidden ? <EyeOff /> : <Eye />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t(section.hidden ? m.cv.sectionHidden : m.cv.sectionHide)}
          </TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={t(m.cv.moveSectionUp(section.heading))}
          disabled={isFirst}
          onClick={() =>
            dispatch("paper.moveSection", { id: resumeId, sectionId: section.id, by: -1 }, { silent: true })
          }
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={t(m.cv.moveSectionDown(section.heading))}
          disabled={isLast}
          onClick={() =>
            dispatch("paper.moveSection", { id: resumeId, sectionId: section.id, by: 1 }, { silent: true })
          }
        >
          <ChevronDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={t(m.cv.removeSection(section.heading))}
          onClick={() =>
            dispatch("paper.removeSection", { id: resumeId, sectionId: section.id })
          }
        >
          <Trash2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-expanded={open}
          aria-controls={`sec-body-${section.id}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr-only">{t(m.cv.toggleSection(section.heading))}</span>
          <ChevronDown
            aria-hidden
            className={cn(
              "transition-transform duration-[var(--duration-state)] ease-snap motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </Button>
      </div>

      <div
        id={`sec-body-${section.id}`}
        className={disclose(open)}
        inert={!open || undefined}
      >
        <div className={cn(discloseInner, "space-y-4 p-4")}>
        {prose ? (
          <DraftTextarea
            id={`body-${section.id}`}
            label={section.heading}
            value={section.body ?? ""}
            hint={hint}
            rows={section.kind === "summary" ? 4 : 3}
            onCommit={(body) => update({ body })}
          />
        ) : (
          <>
            {section.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-pretty">
                {hint}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {section.entries.map((entry, i) => (
                  <EntryEditor
                    key={entry.id}
                    resumeId={resumeId}
                    sectionId={section.id}
                    entry={entry}
                    index={i}
                    isFirst={i === 0}
                    isLast={i === section.entries.length - 1}
                  />
                ))}
              </ul>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                dispatch(
                  "paper.addEntry",
                  { id: resumeId, sectionId: section.id, title: "" },
                  { silent: true },
                )
              }
            >
              <Plus className="size-3.5" />
              {t(m.cv.addEntry)}
            </Button>
          </>
        )}
        </div>
      </div>
    </section>
  );
}

function EntryEditor({
  resumeId,
  sectionId,
  entry,
  index,
  isFirst,
  isLast,
}: {
  resumeId: string;
  sectionId: string;
  entry: CvSection["entries"][number];
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const dispatch = useDispatch();
  const touched = useTouched();
  const { t, m } = useT();

  const update = (fields: Record<string, unknown>) =>
    dispatch(
      "paper.updateEntry",
      { id: resumeId, sectionId, entryId: entry.id, ...fields },
      { silent: true },
    );

  const move = (by: number) =>
    dispatch(
      "paper.moveEntry",
      { id: resumeId, sectionId, entryId: entry.id, by },
      { silent: true },
    );

  return (
    <li
      className={cn(
        "grid gap-3 py-3 first:pt-0 last:pb-0",
        touched.includes(entry.id) && "animate-just-changed",
      )}
    >
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t(m.cv.entryNumber(index + 1))}
        </span>
        <div className="ms-auto flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={t(m.common.moveUp)}
            disabled={isFirst}
            onClick={() => move(-1)}
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={t(m.common.moveDown)}
            disabled={isLast}
            onClick={() => move(1)}
          >
            <ChevronDown />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={t(
              m.cv.removeEntry(entry.title || t(m.cv.entryNumber(index + 1))),
            )}
            onClick={() =>
              dispatch("paper.removeEntry", {
                id: resumeId,
                sectionId,
                entryId: entry.id,
              })
            }
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <DraftInput
        id={`t-${entry.id}`}
        label={t(m.cv.entryTitle)}
        value={entry.title}
        placeholder={t(m.cv.entryTitlePlaceholder)}
        onCommit={(title) => update({ title })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <DraftInput
          id={`o-${entry.id}`}
          label={t(m.cv.entryOrg)}
          value={entry.org ?? ""}
          placeholder={t(m.cv.entryOrgPlaceholder)}
          onCommit={(org) => update({ org })}
        />
        <DraftInput
          id={`p-${entry.id}`}
          label={t(m.cv.entryPeriod)}
          value={entry.period ?? ""}
          placeholder={t(m.cv.entryPeriodPlaceholder)}
          onCommit={(period) => update({ period })}
        />
      </div>
      <DraftTextarea
        id={`d-${entry.id}`}
        label={t(m.cv.entryDetail)}
        value={entry.detail ?? ""}
        rows={3}
        placeholder={t(m.cv.entryDetailPlaceholder)}
        hint={t(m.cv.entryDetailHint)}
        onCommit={(detail) => update({ detail })}
      />
    </li>
  );
}
