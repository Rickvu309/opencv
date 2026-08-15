"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { DraftInput, DraftTextarea } from "@/components/paper/draft-field";
import { PhotoField } from "@/components/paper/photo-field";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDispatch } from "@/lib/actions/store";
import {
  isProseKind,
  sectionDefaults,
  sectionOrder,
  templateHasPhoto,
} from "@/lib/paper/cv";
import type { CvEntry, CvPaper, CvSection, CvSectionKind } from "@/lib/paper/types";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

const lineClass =
  "gap-0 [&_input]:h-7 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-0 [&_input]:shadow-none [&_input]:placeholder:text-black/25";

export function CvCanvas({ cv }: { cv: CvPaper }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const setHeader = (fields: Record<string, unknown>) =>
    dispatch("paper.setHeader", { id: cv.id, ...fields }, { silent: true });

  return (
    <div
      className="w-full min-h-[36rem] max-w-[794px] bg-white text-black shadow-sm ring-1 ring-black/10"
      style={{ viewTransitionName: `paper-sheet-${cv.id}` }}
    >
      <div className="flex h-full flex-col gap-5 overflow-y-auto px-6 py-7 sm:px-10 sm:py-9">
        {templateHasPhoto(cv.theme.template) && (
          <div className="[&_button]:text-black [&_label]:text-black/50">
            <PhotoField cv={cv} />
          </div>
        )}

        <header className="space-y-0.5">
          <Line
            id={`${cv.id}-name`}
            label={t(m.paper.cv.headerName)}
            value={cv.header.name}
            placeholder={t(m.paper.cv.headerName)}
            onCommit={(name) => setHeader({ name })}
            className="[&_input]:text-2xl [&_input]:font-semibold [&_input]:tracking-tight"
          />
          <Line
            id={`${cv.id}-headline`}
            label={t(m.paper.cv.headerHeadline)}
            value={cv.header.headline}
            placeholder={t(m.paper.cv.headerHeadlinePlaceholder)}
            onCommit={(headline) => setHeader({ headline })}
            className="[&_input]:text-black/60"
          />
          <div className="flex flex-wrap gap-x-3">
            <Line
              id={`${cv.id}-email`}
              label={t(m.paper.cv.headerEmail)}
              value={cv.header.email}
              placeholder={t(m.paper.cv.headerEmail)}
              onCommit={(email) => setHeader({ email })}
              className="min-w-[10rem] flex-1 [&_input]:text-sm [&_input]:text-black/60"
            />
            <Line
              id={`${cv.id}-phone`}
              label={t(m.paper.cv.headerPhone)}
              value={cv.header.phone}
              placeholder={t(m.paper.cv.headerPhone)}
              onCommit={(phone) => setHeader({ phone })}
              className="min-w-[8rem] flex-1 [&_input]:text-sm [&_input]:text-black/60"
            />
            <Line
              id={`${cv.id}-location`}
              label={t(m.paper.cv.headerLocation)}
              value={cv.header.location}
              placeholder={t(m.paper.cv.headerLocationPlaceholder)}
              onCommit={(location) => setHeader({ location })}
              className="min-w-[8rem] flex-1 [&_input]:text-sm [&_input]:text-black/60"
            />
          </div>
        </header>

        {cv.sections.map((section, index) => (
          <React.Fragment key={section.id}>
            {index > 0 && (
              <AddBetween cv={cv} />
            )}
            <CanvasSection cv={cv} section={section} index={index} />
          </React.Fragment>
        ))}

        <div className="mt-auto pt-2 md:hidden">
          <AddBetween cv={cv} />
        </div>
      </div>
    </div>
  );
}

function CanvasSection({
  cv,
  section,
  index,
}: {
  cv: CvPaper;
  section: CvSection;
  index: number;
}) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const hint = sectionDefaults[section.kind].hint;
  const update = (fields: Record<string, unknown>) =>
    dispatch(
      "paper.updateSection",
      { id: cv.id, sectionId: section.id, ...fields },
      { silent: true },
    );

  return (
    <section
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/section-id", section.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const fromId = event.dataTransfer.getData("text/section-id");
        if (!fromId || fromId === section.id) return;
        const from = cv.sections.findIndex((item) => item.id === fromId);
        if (from < 0) return;
        dispatch(
          "paper.moveSection",
          { id: cv.id, sectionId: fromId, by: index - from },
          { silent: true },
        );
      }}
      className={cn(
        section.hidden && "opacity-50",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-[var(--duration-surface)] motion-safe:ease-[var(--ease-enter)]",
      )}
    >
      <Line
        id={`${section.id}-heading`}
        label={t(m.paper.cv.sectionName)}
        value={section.heading}
        placeholder={sectionDefaults[section.kind].heading}
        onCommit={(heading) => heading && update({ heading })}
        className="[&_input]:text-[11px] [&_input]:font-semibold [&_input]:tracking-[0.09em] [&_input]:uppercase"
      />
      <div className="mt-1 border-t border-black/10 pt-2">
        {isProseKind(section.kind) ? (
          <DraftTextarea
            id={`${section.id}-body`}
            label={section.heading}
            srLabel
            value={section.body ?? ""}
            placeholder={hint}
            onCommit={(body) => update({ body })}
            rows={3}
            className="[&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:px-0 [&_textarea]:shadow-none [&_textarea]:placeholder:text-black/25"
          />
        ) : (
          <div className="space-y-3">
            {section.entries.map((entry) => (
              <EntryLines
                key={entry.id}
                cv={cv}
                section={section}
                entry={entry}
              />
            ))}
            <GhostEntry cv={cv} section={section} />
          </div>
        )}
      </div>
    </section>
  );
}

function EntryLines({
  cv,
  section,
  entry,
}: {
  cv: CvPaper;
  section: CvSection;
  entry: CvEntry;
}) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const patch = (fields: Record<string, unknown>) =>
    dispatch(
      "paper.updateEntry",
      { id: cv.id, sectionId: section.id, entryId: entry.id, ...fields },
      { silent: true },
    );

  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap gap-x-3">
        <Line
          id={`${entry.id}-title`}
          label={t(m.paper.cv.entryTitle)}
          value={entry.title}
          placeholder={t(m.paper.cv.entryTitlePlaceholder)}
          onCommit={(title) => patch({ title })}
          className="min-w-[8rem] flex-1 [&_input]:font-semibold"
        />
        <Line
          id={`${entry.id}-org`}
          label={t(m.paper.cv.entryOrg)}
          value={entry.org ?? ""}
          placeholder={t(m.paper.cv.entryOrgPlaceholder)}
          onCommit={(org) => patch({ org })}
          className="min-w-[8rem] flex-1 [&_input]:text-black/60"
        />
        <Line
          id={`${entry.id}-period`}
          label={t(m.paper.cv.entryPeriod)}
          value={entry.period ?? ""}
          placeholder={t(m.paper.cv.entryPeriodPlaceholder)}
          onCommit={(period) => patch({ period })}
          className="min-w-[7rem] [&_input]:text-sm [&_input]:text-black/50 [&_input]:tabular-nums"
        />
      </div>
      <DraftTextarea
        id={`${entry.id}-detail`}
        label={t(m.paper.cv.entryDetail)}
        srLabel
        value={entry.detail ?? ""}
        placeholder={t(m.paper.cv.entryDetailHint)}
        onCommit={(detail) => patch({ detail })}
        rows={2}
        className="[&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:px-0 [&_textarea]:shadow-none [&_textarea]:placeholder:text-black/25"
      />
    </div>
  );
}

function GhostEntry({ cv, section }: { cv: CvPaper; section: CvSection }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const [title, setTitle] = React.useState("");
  const [org, setOrg] = React.useState("");
  const [period, setPeriod] = React.useState("");

  const flush = (next: { title?: string; org?: string; period?: string }) => {
    const fields = {
      title: (next.title ?? title).trim(),
      org: (next.org ?? org).trim() || undefined,
      period: (next.period ?? period).trim() || undefined,
    };
    if (!fields.title && !fields.org && !fields.period) return;
    dispatch(
      "paper.addEntry",
      { id: cv.id, sectionId: section.id, ...fields },
      { silent: true },
    );
    setTitle("");
    setOrg("");
    setPeriod("");
  };

  return (
    <div className="flex flex-wrap gap-x-3">
      <GhostLine
        id={`${section.id}-ghost-title`}
        label={t(m.paper.cv.entryTitle)}
        value={title}
        placeholder={t(m.paper.cv.entryTitlePlaceholder)}
        onChange={setTitle}
        onCommit={() => flush({ title })}
        className="min-w-[8rem] flex-1 [&_input]:font-semibold"
      />
      <GhostLine
        id={`${section.id}-ghost-org`}
        label={t(m.paper.cv.entryOrg)}
        value={org}
        placeholder={t(m.paper.cv.entryOrgPlaceholder)}
        onChange={setOrg}
        onCommit={() => flush({ org })}
        className="min-w-[8rem] flex-1 [&_input]:text-black/60"
      />
      <GhostLine
        id={`${section.id}-ghost-period`}
        label={t(m.paper.cv.entryPeriod)}
        value={period}
        placeholder={t(m.paper.cv.entryPeriodPlaceholder)}
        onChange={setPeriod}
        onCommit={() => flush({ period })}
        className="min-w-[7rem] [&_input]:text-sm [&_input]:text-black/50"
      />
    </div>
  );
}

function Line({
  id,
  label,
  value,
  placeholder,
  onCommit,
  className,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
  className?: string;
}) {
  return (
    <DraftInput
      id={id}
      label={label}
      srLabel
      value={value}
      placeholder={placeholder}
      onCommit={onCommit}
      className={cn(lineClass, className)}
    />
  );
}

function GhostLine({
  id,
  label,
  value,
  placeholder,
  onChange,
  onCommit,
  className,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  onCommit: () => void;
  className?: string;
}) {
  return (
    <div className={cn("grid", lineClass, className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-black/25"
      />
    </div>
  );
}

function AddBetween({ cv }: { cv: CvPaper }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const used = new Set(cv.sections.map((s) => s.kind));
  const available = sectionOrder.filter(
    (kind) => kind === "custom" || !used.has(kind),
  );

  return (
    <div className="flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t(m.paper.cv.addSection)}
            className="size-6 text-black/35 hover:text-black"
          >
            <Plus className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          {available.map((kind: CvSectionKind) => (
            <DropdownMenuItem
              key={kind}
              onSelect={() =>
                dispatch("paper.addSection", { id: cv.id, kind }, { silent: true })
              }
            >
              {sectionDefaults[kind].heading}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
