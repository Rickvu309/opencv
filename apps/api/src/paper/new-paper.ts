import type { PaperTemplateId } from "@workspace/domain/paper-doc"

import { paperFromLines } from "./import/word-to-paper.js"
import { templateLines } from "./word-package/word/template.js"

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
