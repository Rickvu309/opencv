// Getting the CV back out.
//
// Four ways out, and each exists because a different reader is on the other end:
//
//  - **PDF** is what a person opens, and it is the browser's own print, not a
//    bundled renderer. A PDF library would add ~500KB to first load and would
//    still be laying out the same HTML the preview already lays out correctly.
//    `@page` in the print stylesheet does the rest. The cost is honest: the user
//    picks "Save as PDF" in their own print dialog.
//  - **Markdown** is what an ATS form and a chat window accept.
//  - **Plain text** is what a paste box accepts without smuggling formatting in.
//  - **JSON** is the user's own copy of their data. Nothing here is a lock-in.

import { bullets, isProseKind, type Resume, type ResumeSection } from "./types";

/** A filename that survives a filesystem: no separators, no accents lost. */
export function fileStem(resume: Resume): string {
  const base = [resume.header.name, resume.label]
    .filter((s) => s.trim())
    .join(" - ");
  return (
    base
      .normalize("NFD")
      // Strip combining marks so "Trần" becomes "Tran" rather than "Trn".
      .replace(new RegExp("\\p{M}", "gu"), "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "CV"
  );
}

function contactLine(resume: Resume): string {
  const { header } = resume;
  return [header.email, header.phone, header.location]
    .filter((s) => s.trim())
    .join(" · ");
}

function visibleSections(resume: Resume): ResumeSection[] {
  return resume.sections.filter((s) => !s.hidden);
}

/** True when a section would print nothing, so exports can skip its heading. */
export function isEmptySection(section: ResumeSection): boolean {
  return isProseKind(section.kind)
    ? !section.body?.trim()
    : !section.entries.some((e) => e.title.trim() || e.detail?.trim());
}

export function toMarkdown(resume: Resume): string {
  const { header } = resume;
  const out: string[] = [];

  out.push(`# ${header.name || resume.label}`);
  if (header.headline.trim()) out.push(`_${header.headline.trim()}_`);
  const contact = contactLine(resume);
  if (contact) out.push(contact);
  if (header.links.length > 0) {
    out.push(
      header.links
        .filter((l) => l.url.trim())
        .map((l) => `[${l.label || l.url}](${l.url})`)
        .join(" · "),
    );
  }

  for (const section of visibleSections(resume)) {
    if (isEmptySection(section)) continue;
    out.push("", `## ${section.heading}`);

    if (isProseKind(section.kind)) {
      out.push(section.body!.trim());
      continue;
    }

    for (const entry of section.entries) {
      if (!entry.title.trim() && !entry.detail?.trim()) continue;
      const heading = [entry.title, entry.org].filter(Boolean).join(" — ");
      out.push("", `### ${heading}`);
      const meta = [entry.period, entry.location].filter(Boolean).join(" · ");
      if (meta) out.push(`_${meta}_`);
      if (entry.url?.trim()) out.push(entry.url.trim());
      for (const bullet of bullets(entry.detail)) out.push(`- ${bullet}`);
    }
  }

  return out.join("\n") + "\n";
}

export function toPlainText(resume: Resume): string {
  const { header } = resume;
  const out: string[] = [];

  out.push(header.name || resume.label);
  if (header.headline.trim()) out.push(header.headline.trim());
  const contact = contactLine(resume);
  if (contact) out.push(contact);
  for (const link of header.links) {
    if (link.url.trim()) out.push(`${link.label}: ${link.url}`.trim());
  }

  for (const section of visibleSections(resume)) {
    if (isEmptySection(section)) continue;
    out.push("", section.heading.toUpperCase());

    if (isProseKind(section.kind)) {
      out.push(section.body!.trim());
      continue;
    }

    for (const entry of section.entries) {
      if (!entry.title.trim() && !entry.detail?.trim()) continue;
      out.push("");
      out.push([entry.title, entry.org].filter(Boolean).join(" — "));
      const meta = [entry.period, entry.location].filter(Boolean).join(" · ");
      if (meta) out.push(meta);
      for (const bullet of bullets(entry.detail)) out.push(`  - ${bullet}`);
    }
  }

  return out.join("\n") + "\n";
}

export function toJson(resume: Resume): string {
  return JSON.stringify(resume, null, 2);
}

/**
 * Hand a string to the browser as a file.
 *
 * Client-only: there is no server copy of the CV to link to, and there does not
 * need to be. The blob URL is revoked on the next frame rather than immediately,
 * because Safari cancels a download whose URL is revoked in the same tick.
 */
export function download(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
