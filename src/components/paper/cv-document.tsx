"use client";

// The CV as a reader sees it. One component for writing, preview, and print,
// because two would drift and the printed one is the one that matters.
//
// Deliberately styled with its own values rather than the app's theme tokens: a
// CV is a document, not a screen. It is black on white in dark mode, in the
// preview, and on paper, because that is what the person on the other end
// opens. The only thing the user chooses is the template, the accent and how
// tightly it packs.

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
import { messages } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/use-t";
import {
  bullets,
  isProseKind,
  printableSections,
  sectionDefaults,
  sectionOrder,
  templateHasPhoto,
} from "@/lib/paper/cv";
import { visiblePhotoUrl } from "@/lib/paper/photo-url";
import type {
  CvAccent,
  CvDensity,
  CvEntry,
  CvPaper,
  CvSection,
  CvSectionKind,
  CvTemplate,
} from "@/lib/paper/types";
import { cn } from "@/lib/utils";

function layoutFor(template: CvTemplate) {
  return {
    centred: template === "classic" || template === "internship" || template === "service",
    accentBar: template === "modern" || template === "design",
    accentName: template === "modern" || template === "design" || template === "technical",
    accentHeadings: template !== "classic" && template !== "service",
    headingRule: template === "classic" || template === "compact" || template === "service",
    compact: template === "compact",
    linksLead: template === "technical" || template === "design",
  };
}

/** A4 at 96dpi. The preview scales this down; print uses it at size. */
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

export const cvAccentColor: Record<CvAccent, string> = {
  ink: "#111827",
  blue: "#1d4ed8",
  green: "#15803d",
  plum: "#86198f",
};

/** Vertical rhythm, in px. One knob, so "tight" is a real page-fitting tool. */
export const cvDensityScale: Record<CvDensity, number> = {
  airy: 1.25,
  normal: 1,
  tight: 0.78,
};

const field =
  "gap-0 [&_input]:h-auto [&_input]:min-h-0 [&_input]:rounded-none [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-0 [&_input]:py-0 [&_input]:text-[length:inherit] [&_input]:leading-[inherit] [&_input]:shadow-none [&_input]:md:text-[length:inherit] [&_input]:placeholder:text-black/25 [&_input]:focus-visible:border-transparent [&_input]:focus-visible:ring-0 dark:[&_input]:bg-transparent";

const area =
  "gap-0 [&_textarea]:min-h-0 [&_textarea]:rounded-none [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:px-0 [&_textarea]:py-0 [&_textarea]:text-[length:inherit] [&_textarea]:leading-[inherit] [&_textarea]:shadow-none [&_textarea]:md:text-[length:inherit] [&_textarea]:placeholder:text-black/25 [&_textarea]:focus-visible:border-transparent [&_textarea]:focus-visible:ring-0 dark:[&_textarea]:bg-transparent";

function Bullets({ detail }: { detail?: string }) {
  const items = bullets(detail);
  if (items.length === 0) return null;
  return (
    <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginTop: i === 0 ? 0 : 3 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function SectionBody({
  section,
  accent,
  gap,
}: {
  section: CvSection;
  accent: string;
  gap: number;
}) {
  if (isProseKind(section.kind)) {
    return (
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{section.body?.trim()}</p>
    );
  }

  return (
    <div>
      {section.entries.map((entry, i) => {
        if (!entry.title.trim() && !entry.detail?.trim()) return null;
        const meta = [entry.period, entry.location].filter(Boolean).join(" · ");
        return (
          <div
            key={entry.id}
            style={{
              marginTop: i === 0 ? 0 : gap,
              breakInside: "avoid",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
              }}
            >
              <span>
                <strong style={{ fontWeight: 600 }}>{entry.title}</strong>
                {entry.org && (
                  <span style={{ color: "#4b5563" }}> · {entry.org}</span>
                )}
              </span>
              {meta && (
                <span
                  style={{
                    color: "#6b7280",
                    fontSize: "0.92em",
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {meta}
                </span>
              )}
            </div>
            {entry.url?.trim() && (
              <div style={{ color: accent, fontSize: "0.9em", marginTop: 2 }}>
                {entry.url.trim()}
              </div>
            )}
            <Bullets detail={entry.detail} />
          </div>
        );
      })}
    </div>
  );
}

function pageChrome(
  print: boolean,
  layout: ReturnType<typeof layoutFor>,
  fontSize: number,
): React.CSSProperties {
  return {
    width: PAGE_WIDTH,
    minHeight: print ? undefined : PAGE_HEIGHT,
    padding: layout.compact ? "40px 48px" : "52px 56px",
    background: "#fff",
    color: "#111827",
    fontSize,
    lineHeight: 1.5,
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    boxSizing: "border-box",
  };
}

/**
 * `print` drops the page's fixed height and shadow: on paper the browser
 * paginates, so pinning the first page's height would clip everything after it.
 * `edit` keeps empty sections on the page as ghosts so you type on the A4.
 */
export function CvDocument({
  cv,
  print = false,
  edit = false,
}: {
  cv: CvPaper;
  print?: boolean;
  edit?: boolean;
}) {
  if (edit) return <CvDocumentEdit cv={cv} />;
  return <CvDocumentRead cv={cv} print={print} />;
}

function CvDocumentRead({ cv, print }: { cv: CvPaper; print: boolean }) {
  const { header, theme } = cv;
  const accent = cvAccentColor[theme.accent];
  const d = cvDensityScale[theme.density];
  const layout = layoutFor(theme.template);
  const sectionGap = Math.round(18 * d);
  const entryGap = Math.round(10 * d);
  const fontSize = layout.compact ? 12.5 : 13.5;
  const visible = printableSections(cv);
  const centred = layout.centred;
  const photo = visiblePhotoUrl(cv);

  return (
    <div data-cv-page style={pageChrome(print, layout, fontSize)}>
      {photo && (
        <div style={{ textAlign: centred ? "center" : "left", marginBottom: Math.round(12 * d) }}>
          <img
            src={photo}
            alt=""
            style={{
              width: 96,
              height: 96,
              borderRadius: 6,
              objectFit: "cover",
              display: "inline-block",
            }}
          />
        </div>
      )}
      <header
        style={{
          textAlign: centred ? "center" : "left",
          borderLeft: layout.accentBar ? `3px solid ${accent}` : undefined,
          paddingLeft: layout.accentBar ? 14 : undefined,
          borderBottom: centred ? `1px solid #e5e7eb` : undefined,
          paddingBottom: centred ? Math.round(14 * d) : undefined,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: layout.compact ? 22 : 26,
            lineHeight: 1.15,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: layout.accentName ? accent : "#111827",
          }}
        >
          {header.name.trim() || cv.label}
        </h1>

        {header.headline.trim() && (
          <p style={{ margin: "4px 0 0", color: "#4b5563" }}>
            {header.headline.trim()}
          </p>
        )}

        {(header.email || header.phone || header.location) && (
          <p
            style={{
              margin: "6px 0 0",
              color: "#4b5563",
              fontSize: "0.92em",
            }}
          >
            {[header.email, header.phone, header.location]
              .filter((s) => s.trim())
              .join("  ·  ")}
          </p>
        )}

        {header.links.filter((l) => l.url.trim()).length > 0 && (
          <p
            style={{
              margin: layout.linksLead ? "8px 0 0" : "3px 0 0",
              fontSize: layout.linksLead ? "1em" : "0.92em",
              color: accent,
            }}
          >
            {header.links
              .filter((l) => l.url.trim())
              .map((l) => l.label.trim() || l.url.trim())
              .join("  ·  ")}
          </p>
        )}
      </header>

      {visible.map((section) => (
        <section
          key={section.id}
          style={{ marginTop: sectionGap, breakInside: "avoid-page" }}
        >
          <h2
            style={{
              margin: `0 0 ${Math.round(7 * d)}px`,
              fontSize: layout.compact ? 11 : 11.5,
              fontWeight: 600,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: layout.accentHeadings ? accent : "#111827",
              borderBottom: layout.headingRule ? "1px solid #e5e7eb" : undefined,
              paddingBottom: layout.headingRule ? 4 : undefined,
            }}
          >
            {section.heading}
          </h2>
          <SectionBody section={section} accent={accent} gap={entryGap} />
        </section>
      ))}

      {visible.length === 0 && (
        <p style={{ marginTop: 40, color: "#9ca3af", textAlign: "center" }}>
          {messages.paper.cv.previewEmpty}
        </p>
      )}
    </div>
  );
}

function CvDocumentEdit({ cv }: { cv: CvPaper }) {
  const dispatch = useDispatch();
  const { t, m } = useT();
  const { header, theme } = cv;
  const accent = cvAccentColor[theme.accent];
  const d = cvDensityScale[theme.density];
  const layout = layoutFor(theme.template);
  const sectionGap = Math.round(18 * d);
  const fontSize = layout.compact ? 12.5 : 13.5;
  const centred = layout.centred;
  const sections = cv.sections.filter((section) => !section.hidden);
  const setHeader = (fields: Record<string, unknown>) =>
    dispatch("paper.setHeader", { id: cv.id, ...fields }, { silent: true });

  return (
    <div data-cv-page style={pageChrome(false, layout, fontSize)}>
      {templateHasPhoto(theme.template) && (
        <div
          style={{
            textAlign: centred ? "center" : "left",
            marginBottom: Math.round(12 * d),
          }}
        >
          <PhotoField cv={cv} embed />
        </div>
      )}

      <header
        style={{
          textAlign: centred ? "center" : "left",
          borderLeft: layout.accentBar ? `3px solid ${accent}` : undefined,
          paddingLeft: layout.accentBar ? 14 : undefined,
          borderBottom: centred ? `1px solid #e5e7eb` : undefined,
          paddingBottom: centred ? Math.round(14 * d) : undefined,
        }}
      >
        <Line
          id={`${cv.id}-name`}
          label={t(m.paper.cv.headerName)}
          value={header.name}
          placeholder={t(m.paper.cv.headerName)}
          onCommit={(name) => setHeader({ name })}
          className={cn(centred && "[&_input]:text-center")}
          style={{
            fontSize: layout.compact ? 22 : 26,
            lineHeight: 1.15,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: layout.accentName ? accent : "#111827",
          }}
        />
        <Line
          id={`${cv.id}-headline`}
          label={t(m.paper.cv.headerHeadline)}
          value={header.headline}
          placeholder={t(m.paper.cv.headerHeadlinePlaceholder)}
          onCommit={(headline) => setHeader({ headline })}
          className={cn(centred && "[&_input]:text-center")}
          style={{ marginTop: 4, color: "#4b5563" }}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0 12px",
            marginTop: 6,
            color: "#4b5563",
            fontSize: "0.92em",
            justifyContent: centred ? "center" : "flex-start",
          }}
        >
          <Line
            id={`${cv.id}-email`}
            label={t(m.paper.cv.headerEmail)}
            value={header.email}
            placeholder={t(m.paper.cv.headerEmail)}
            onCommit={(email) => setHeader({ email })}
            className="min-w-[10rem] flex-1"
          />
          <Line
            id={`${cv.id}-phone`}
            label={t(m.paper.cv.headerPhone)}
            value={header.phone}
            placeholder={t(m.paper.cv.headerPhone)}
            onCommit={(phone) => setHeader({ phone })}
            className="min-w-[8rem] flex-1"
          />
          <Line
            id={`${cv.id}-location`}
            label={t(m.paper.cv.headerLocation)}
            value={header.location}
            placeholder={t(m.paper.cv.headerLocationPlaceholder)}
            onCommit={(location) => setHeader({ location })}
            className="min-w-[8rem] flex-1"
          />
        </div>
      </header>

      {sections.map((section, index) => (
        <React.Fragment key={section.id}>
          {index > 0 && (
            <div style={{ marginTop: Math.round(sectionGap / 2) }}>
              <AddBetween cv={cv} />
            </div>
          )}
          <EditSection
            cv={cv}
            section={section}
            index={index}
            accent={accent}
            d={d}
            layout={layout}
            sectionGap={sectionGap}
          />
        </React.Fragment>
      ))}

      <div style={{ marginTop: Math.round(sectionGap / 2) }}>
        <AddBetween cv={cv} />
      </div>
    </div>
  );
}

function EditSection({
  cv,
  section,
  index,
  accent,
  d,
  layout,
  sectionGap,
}: {
  cv: CvPaper;
  section: CvSection;
  index: number;
  accent: string;
  d: number;
  layout: ReturnType<typeof layoutFor>;
  sectionGap: number;
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
      style={{ marginTop: sectionGap, breakInside: "avoid-page" }}
    >
      <Line
        id={`${section.id}-heading`}
        label={t(m.paper.cv.sectionName)}
        value={section.heading}
        placeholder={sectionDefaults[section.kind].heading}
        onCommit={(heading) => heading && update({ heading })}
        style={{
          fontSize: layout.compact ? 11 : 11.5,
          fontWeight: 600,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: layout.accentHeadings ? accent : "#111827",
          borderBottom: layout.headingRule ? "1px solid #e5e7eb" : undefined,
          paddingBottom: layout.headingRule ? 4 : undefined,
          marginBottom: Math.round(7 * d),
        }}
      />
      {isProseKind(section.kind) ? (
        <DraftTextarea
          id={`${section.id}-body`}
          label={section.heading}
          srLabel
          value={section.body ?? ""}
          placeholder={hint}
          onCommit={(body) => update({ body })}
          rows={3}
          className={area}
        />
      ) : (
        <div>
          {section.entries.map((entry) => (
            <EntryLines
              key={entry.id}
              cv={cv}
              section={section}
              entry={entry}
              gap={Math.round(10 * d)}
            />
          ))}
          <GhostEntry cv={cv} section={section} />
        </div>
      )}
    </section>
  );
}

function EntryLines({
  cv,
  section,
  entry,
  gap,
}: {
  cv: CvPaper;
  section: CvSection;
  entry: CvEntry;
  gap: number;
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
    <div style={{ marginTop: gap, breakInside: "avoid" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 12px" }}>
        <Line
          id={`${entry.id}-title`}
          label={t(m.paper.cv.entryTitle)}
          value={entry.title}
          placeholder={t(m.paper.cv.entryTitlePlaceholder)}
          onCommit={(title) => patch({ title })}
          className="min-w-[8rem] flex-1"
          style={{ fontWeight: 600 }}
        />
        <Line
          id={`${entry.id}-org`}
          label={t(m.paper.cv.entryOrg)}
          value={entry.org ?? ""}
          placeholder={t(m.paper.cv.entryOrgPlaceholder)}
          onCommit={(org) => patch({ org })}
          className="min-w-[8rem] flex-1"
          style={{ color: "#4b5563" }}
        />
        <Line
          id={`${entry.id}-period`}
          label={t(m.paper.cv.entryPeriod)}
          value={entry.period ?? ""}
          placeholder={t(m.paper.cv.entryPeriodPlaceholder)}
          onCommit={(period) => patch({ period })}
          className="min-w-[7rem]"
          style={{ color: "#6b7280", fontSize: "0.92em", fontVariantNumeric: "tabular-nums" }}
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
        className={area}
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
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0 12px", marginTop: 8 }}>
      <GhostLine
        id={`${section.id}-ghost-title`}
        label={t(m.paper.cv.entryTitle)}
        value={title}
        placeholder={t(m.paper.cv.entryTitlePlaceholder)}
        onChange={setTitle}
        onCommit={() => flush({ title })}
        className="min-w-[8rem] flex-1"
        style={{ fontWeight: 600 }}
      />
      <GhostLine
        id={`${section.id}-ghost-org`}
        label={t(m.paper.cv.entryOrg)}
        value={org}
        placeholder={t(m.paper.cv.entryOrgPlaceholder)}
        onChange={setOrg}
        onCommit={() => flush({ org })}
        className="min-w-[8rem] flex-1"
        style={{ color: "#4b5563" }}
      />
      <GhostLine
        id={`${section.id}-ghost-period`}
        label={t(m.paper.cv.entryPeriod)}
        value={period}
        placeholder={t(m.paper.cv.entryPeriodPlaceholder)}
        onChange={setPeriod}
        onCommit={() => flush({ period })}
        className="min-w-[7rem]"
        style={{ color: "#6b7280", fontSize: "0.92em" }}
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
  style,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (next: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <DraftInput
        id={id}
        label={label}
        srLabel
        value={value}
        placeholder={placeholder}
        onCommit={onCommit}
        className={cn(field, className)}
      />
    </div>
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
  style,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  onCommit: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("grid", className)} style={style}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        className="w-full bg-transparent outline-none placeholder:text-black/25"
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
