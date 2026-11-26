import {
  PAPER_START_TEMPLATE,
  paperDocNameSchema,
  templateLines,
  templatePageName,
  type PaperTemplateId,
} from "@workspace/domain/paper-doc"

import { paperFromLines } from "./import/word-to-paper.js"

export function startingPaper(input: {
  kind: "cv" | "letter"
  templateId?: PaperTemplateId
  lines?: readonly string[]
}) {
  if (input.templateId)
    return paperFromLines("cv", templateLines(input.templateId))
  if (input.lines)
    return paperFromLines(
      input.kind,
      input.lines.map((text) => ({ style: "Normal" as const, text }))
    )
  return undefined
}

export function startedName(
  input: { kind: "cv" | "letter"; templateId?: PaperTemplateId; name?: string },
  company: string | null
) {
  if (input.name) return input.name
  const base =
    input.kind === "cv"
      ? templatePageName(input.templateId ?? PAPER_START_TEMPLATE)
      : "Cover letter"
  const named = company?.trim() ? `${base}, ${company.trim()}` : null
  return named && paperDocNameSchema.safeParse(named).success ? named : base
}
