import type { CvPaper, CvSection } from "./types";
import { bullets, isProseKind } from "./cv";

export function fileStem(paper: CvPaper): string {
  const base = [paper.header.name, paper.label]
    .filter((s) => s.trim())
    .join(" - ");
  return (
    base
      .normalize("NFD")
      .replace(new RegExp("\\p{M}", "gu"), "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "CV"
  );
}

function contactLine(paper: CvPaper): string {
  const { header } = paper;
  return [header.email, header.phone, header.location]
    .filter((s) => s.trim())
    .join(" · ");
}

function visibleSections(paper: CvPaper): CvSection[] {
  return paper.sections.filter((s) => !s.hidden);
}

export function isEmptySection(section: CvSection): boolean {
  return isProseKind(section.kind)
    ? !section.body?.trim()
    : !section.entries.some((e) => e.title.trim() || e.detail?.trim());
}

export function toMarkdown(paper: CvPaper): string {
  const { header } = paper;
  const out: string[] = [];

  out.push(`# ${header.name || paper.label}`);
  if (header.headline.trim()) out.push(`_${header.headline.trim()}_`);
  const contact = contactLine(paper);
  if (contact) out.push(contact);
  if (header.links.length > 0) {
    out.push(
      header.links
        .filter((l) => l.url.trim())
        .map((l) => `[${l.label || l.url}](${l.url})`)
        .join(" · "),
    );
  }

  for (const section of visibleSections(paper)) {
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

export function toPlainText(paper: CvPaper): string {
  const { header } = paper;
  const out: string[] = [];

  out.push(header.name || paper.label);
  if (header.headline.trim()) out.push(header.headline.trim());
  const contact = contactLine(paper);
  if (contact) out.push(contact);
  for (const link of header.links) {
    if (link.url.trim()) out.push(`${link.label}: ${link.url}`.trim());
  }

  for (const section of visibleSections(paper)) {
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

export function toJson(paper: CvPaper): string {
  return JSON.stringify(paper, null, 2);
}

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
