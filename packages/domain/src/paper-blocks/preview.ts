import type { CvDocument, CvTemplateId } from "../paper-codecs.js"
import { blocksToCvCodec } from "./codec.js"
import type { CvBlockDocument, CvSectionKind } from "./document.js"
import { plainTextOf } from "./registry.js"

export type CvPreviewModel = Omit<CvDocument, "projects" | "languages"> & {
  projects: NonNullable<CvDocument["projects"]>
  languages: string[]
  activities: string[]
  awards: string[]
}

function sectionLines(
  document: CvBlockDocument,
  kind: CvSectionKind
): string[] {
  const lines: string[] = []
  for (const section of document.sections) {
    if (section.kind !== kind) continue
    for (const block of section.blocks) {
      for (const line of plainTextOf(block).split("\n")) {
        if (line.trim()) lines.push(line)
      }
    }
  }
  return lines
}

export function blocksToPreviewModel(
  document: CvBlockDocument,
  templateId: CvTemplateId = "internship"
): CvPreviewModel {
  const codec = blocksToCvCodec(document, templateId)
  return {
    templateId: codec.templateId,
    name: codec.name,
    headline: codec.headline,
    contact: codec.contact,
    summary: codec.summary,
    experience: codec.experience,
    education: codec.education,
    skills: codec.skills,
    projects: codec.projects ?? [],
    languages: codec.languages ?? [],
    activities: sectionLines(document, "activities"),
    awards: sectionLines(document, "awards"),
    ...(codec.photoUrl ? { photoUrl: codec.photoUrl } : {}),
  }
}

/** The fields the current templates read. Activities and awards stay on the preview. */
export function previewToCvDocument(preview: CvPreviewModel): CvDocument {
  const document: CvDocument = {
    templateId: preview.templateId,
    name: preview.name,
    headline: preview.headline,
    contact: preview.contact,
    summary: preview.summary,
    experience: preview.experience,
    education: preview.education,
    skills: preview.skills,
  }
  if (preview.projects.length > 0) document.projects = preview.projects
  if (preview.languages.length > 0) document.languages = preview.languages
  if (preview.photoUrl) document.photoUrl = preview.photoUrl
  return document
}
