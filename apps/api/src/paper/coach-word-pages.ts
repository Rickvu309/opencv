import {
  PAPER_COACH_WORD_PAGE_NOTE,
  paperCoachWordPageSchema,
  paperViewSchema,
  parsePaperId,
  parseUserId,
  type PaperCoachWordPage,
  type PaperView,
} from "@workspace/domain"

import { listPackagePapers } from "./package-list.js"
import { readOutline } from "./outline.js"

const pageFields = paperViewSchema.omit({ paper: true }).strip()

export function coachWordPage(
  view: PaperView,
  content: string | null
): PaperCoachWordPage {
  return paperCoachWordPageSchema.parse({
    ...pageFields.parse(view),
    format: "word",
    content,
    note: PAPER_COACH_WORD_PAGE_NOTE,
  })
}

export async function coachPaperList(owner: string, views: PaperView[]) {
  const words = new Set((await listPackagePapers(owner)).map((page) => page.id))
  return views.map((view) =>
    words.has(view.id) ? coachWordPage(view, null) : view
  )
}

export async function coachWordPageWithText(owner: string, view: PaperView) {
  const read = await readOutline(
    parseUserId(owner),
    parsePaperId(view.id),
    undefined
  )
  return coachWordPage(view, read.outline)
}
