import {
  PAPER_START_BOUNDS,
  PAPER_START_TEMPLATE,
  paperDocNameSchema,
  type PaperStartInput,
} from "@workspace/domain"

import { packageFailure } from "./package-pages.js"
import { blankPageBytes } from "./word/mutate.js"
import {
  templateLines,
  templatePageBytes,
  templatePageName,
  type TemplateLine,
} from "./word/template.js"

type StartChoice = Pick<PaperStartInput, "kind" | "templateId" | "name">

export function startedLines(input: StartChoice): TemplateLine[] {
  const lines =
    input.kind === "cv"
      ? templateLines(input.templateId ?? PAPER_START_TEMPLATE)
      : []
  if (
    lines.length > PAPER_START_BOUNDS.lines ||
    lines.some((line) => line.text.length > PAPER_START_BOUNDS.lineLength)
  )
    return packageFailure(
      "This template is longer than a new page may start. No document was made."
    )
  return lines
}

export function startedBytes(input: StartChoice) {
  if (input.kind === "letter") return blankPageBytes()
  startedLines(input)
  return templatePageBytes(input.templateId ?? PAPER_START_TEMPLATE)
}

export function startedName(input: StartChoice, company: string | null) {
  if (input.name) return input.name
  const base =
    input.kind === "cv"
      ? templatePageName(input.templateId ?? PAPER_START_TEMPLATE)
      : "Cover letter"
  const named = company?.trim() ? `${base}, ${company.trim()}` : null
  return named && paperDocNameSchema.safeParse(named).success ? named : base
}
