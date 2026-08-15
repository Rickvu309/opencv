// The CV as a reader sees it. One component for the on-screen preview and for
// print, because two would drift and the printed one is the one that matters.
//
// Deliberately styled with its own values rather than the app's theme tokens: a
// CV is a document, not a screen. It is black on white in dark mode, in the
// preview, and on paper, because that is what the person on the other end
// opens. The only thing the user chooses is the template, the accent and how
// tightly it packs.

import { visiblePhotoUrl } from "@/lib/paper/photo-url";
import { messages } from "@/lib/i18n/messages";
import { bullets, isProseKind } from "@/lib/paper/cv";
import type {
  CvPaper,
  CvAccent,
  CvDensity,
  CvSection,
  CvTemplate,
} from "@/lib/paper/types";

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

const accentColor: Record<CvAccent, string> = {
  ink: "#111827",
  blue: "#1d4ed8",
  green: "#15803d",
  plum: "#86198f",
};

/** Vertical rhythm, in px. One knob, so "tight" is a real page-fitting tool. */
const densityScale: Record<CvDensity, number> = {
  airy: 1.25,
  normal: 1,
  tight: 0.78,
};

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
              // Keep a job and its bullets on the same page.
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

/**
 * `print` drops the page's fixed height and shadow: on paper the browser
 * paginates, so pinning the first page's height would clip everything after it.
 */
export function CvDocument({
  cv,
  print = false,
}: {
  cv: CvPaper;
  print?: boolean;
}) {
  const { header, theme } = cv;
  const accent = accentColor[theme.accent];
  const d = densityScale[theme.density];

  const layout = layoutFor(theme.template);
  const sectionGap = Math.round(18 * d);
  const entryGap = Math.round(10 * d);
  const fontSize = layout.compact ? 12.5 : 13.5;

  const visible = cv.sections.filter((section) => {
    if (section.hidden) return false;
    return isProseKind(section.kind)
      ? Boolean(section.body?.trim())
      : section.entries.some((e) => e.title.trim() || e.detail?.trim());
  });

  const centred = layout.centred;
  // Null unless the user uploaded one *and* this template has a photo area.
  const photo = visiblePhotoUrl(cv);

  return (
    <div
      data-cv-page
      style={{
        width: PAGE_WIDTH,
        minHeight: print ? undefined : PAGE_HEIGHT,
        padding: layout.compact ? "40px 48px" : "52px 56px",
        background: "#fff",
        color: "#111827",
        fontSize,
        lineHeight: 1.5,
        fontFamily: "var(--font-sans), system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      {/* The photo, where the template has somewhere to put it. Above the name
          and centred, which is where a Vietnamese CV carries one. Rendered as
          a plain <img> pointing at a same-origin route: the browser fetches it
          for the print copy too, which is what carries it into the PDF. */}
      {photo && (
        <div style={{ textAlign: centred ? "center" : "left", marginBottom: Math.round(12 * d) }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- bytes from
              Postgres behind a session, not an optimisable static asset. */}
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

      {/* ── Sections ───────────────────────────────────────── */}
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
          {/* The document's own language: this sits inside the page frame,
              where the surrounding text is the CV's. */}
          {messages.paper.cv.previewEmpty}
        </p>
      )}
    </div>
  );
}
