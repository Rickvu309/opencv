import type {
  ApplyStage,
  ApplyTrackKind,
  PaperContentKind,
  ThreadToolPart,
} from "@workspace/domain"
import {
  DEFAULT_PAPER_DOC_NAME,
  PAPER_KIND_LABEL,
  STARTER_CV_NAME,
} from "@workspace/domain"

/** Curated hunks — this prototype does not run a real diff. */
export type DiffLineKind = "eq" | "del" | "add"

export type DiffLine = {
  kind: DiffLineKind
  text: string
}

export type DiffHunk = {
  section: string
  lines: DiffLine[]
}

export type UpdateContentKind = PaperContentKind

export type UpdateContentFixture = {
  kind: UpdateContentKind
  docName: string
  summary: string
  reversal: string
  hunks: DiffHunk[]
}

export type MoveCardFixture = {
  title: string
  company: string
  from: ApplyStage
  to: ApplyStage
  starred: boolean
  trackDate: string
  trackKind: ApplyTrackKind
  summary: string
  reversal: string
}

export type CreateDocFixture = {
  kind: PaperContentKind
  name: string
  previewTitle: string
  previewLines: string[]
  summary: string
  reversal: string
}

export const UPDATE_CONTENT_FIXTURES: Record<
  UpdateContentKind,
  UpdateContentFixture
> = {
  cv: {
    kind: "cv",
    docName: STARTER_CV_NAME,
    summary: `Updated content of ${STARTER_CV_NAME}`,
    reversal: "Undo by writing the previous content back.",
    hunks: [
      {
        section: "Summary",
        lines: [
          {
            kind: "del",
            text: "Year-4 Information Systems student targeting associate product manager internships.",
          },
          {
            kind: "add",
            text: "Year-4 Information Systems student targeting APM internships. I learn by shipping small experiments, not slide decks alone.",
          },
        ],
      },
      {
        section: "Experience · Campus product club",
        lines: [
          {
            kind: "eq",
            text: "Ran weekly problem interviews with 8 classmates; turned themes into a one-page PRD.",
          },
          {
            kind: "del",
            text: "Facilitated prioritization workshops using RICE; team shipped a clickable Figma prototype in 3 weeks.",
          },
          {
            kind: "add",
            text: "Ran RICE workshops with 6 teammates; shipped a clickable Figma prototype in 3 weeks and wrote the decision log.",
          },
        ],
      },
    ],
  },
  letter: {
    kind: "letter",
    docName: "Associate PM intern",
    summary: "Updated content of Associate PM intern",
    reversal: "Undo by writing the previous content back.",
    hunks: [
      {
        section: "Opening",
        lines: [
          {
            kind: "del",
            text: "I am writing to apply for the Associate PM intern role at Local startup.",
          },
          {
            kind: "add",
            text: "I am applying for the Associate PM intern role because your JD asks for discovery notes and one shipped experiment — that is the work I already do.",
          },
        ],
      },
      {
        section: "Evidence",
        lines: [
          {
            kind: "eq",
            text: "On campus I ran eight classmate interviews and turned the themes into a one-page PRD.",
          },
          {
            kind: "add",
            text: "The checkout Proof sits next to this Letter if you want the hallway-test numbers.",
          },
        ],
      },
    ],
  },
  proof: {
    kind: "proof",
    docName: "Product card resize study",
    summary: "Updated content of Product card resize study",
    reversal: "Undo by writing the previous content back.",
    hunks: [
      {
        section: "Outcome",
        lines: [
          {
            kind: "del",
            text: "Variant B cut average time-to-tap on add-to-cart by 1.4s.",
          },
          {
            kind: "add",
            text: "Variant B cut average time-to-tap on add-to-cart by 1.4s and raised successful taps from 67% to 85% in a 12-person hallway study.",
          },
        ],
      },
      {
        section: "Next step",
        lines: [
          {
            kind: "eq",
            text: "Share the write-up with UIT Product Club.",
          },
          {
            kind: "add",
            text: "Link this Proof on the PM-track CV before sending Local startup.",
          },
        ],
      },
    ],
  },
}

export const MOVE_CARD_FIXTURE: MoveCardFixture = {
  title: "Associate PM intern",
  company: "Local startup",
  from: "inbox",
  to: "prep",
  starred: true,
  trackDate: "2026-08-27",
  trackKind: "followup",
  summary: "Moved Associate PM intern at Local startup to Prep",
  reversal: "Undo by moving the card back to its previous Stage and order.",
}

export const CREATE_DOC_FIXTURES: Record<PaperContentKind, CreateDocFixture> = {
  cv: {
    kind: "cv",
    name: DEFAULT_PAPER_DOC_NAME.cv,
    previewTitle: "Your name",
    previewLines: [
      "Early-career product intern",
      "Empty CV — headline and sections are still blank.",
    ],
    summary: `Created ${PAPER_KIND_LABEL.cv} ${DEFAULT_PAPER_DOC_NAME.cv}`,
    reversal: "Undo by deleting the Paper doc.",
  },
  letter: {
    kind: "letter",
    name: DEFAULT_PAPER_DOC_NAME.letter,
    previewTitle: "Untitled Letter",
    previewLines: [
      "Dear hiring manager,",
      "The body is empty. The Coach started the file so you can write in Paper.",
    ],
    summary: `Created ${PAPER_KIND_LABEL.letter} ${DEFAULT_PAPER_DOC_NAME.letter}`,
    reversal: "Undo by deleting the Paper doc.",
  },
  proof: {
    kind: "proof",
    name: DEFAULT_PAPER_DOC_NAME.proof,
    previewTitle: "Untitled Proof",
    previewLines: [
      "Context → what I did → outcome",
      "No steps yet. Add the first evidence chain in Paper.",
    ],
    summary: `Created ${PAPER_KIND_LABEL.proof} ${DEFAULT_PAPER_DOC_NAME.proof}`,
    reversal: "Undo by deleting the Paper doc.",
  },
}

export const FAILURE_SUMMARIES = {
  updateContent: "Paper document not found",
  moveCard: "Apply card not found",
  createDoc: "Name is required",
} as const

export function genericToolPart(
  name: string,
  summary: string,
  ok: boolean,
  reversal?: string
): ThreadToolPart {
  return {
    type: "tool",
    name,
    summary,
    ok,
    reversal:
      ok && reversal
        ? { possible: true, description: reversal }
        : ok
          ? undefined
          : undefined,
  }
}

const STAGE_SUMMARY: Record<ApplyStage, string> = {
  inbox: "Inbox",
  prep: "Prep",
  sent: "Sent",
  live: "Live",
  closed: "Closed",
}

export function moveCardSummary(
  fixture: Pick<MoveCardFixture, "title" | "company" | "to">
) {
  return `Moved ${fixture.title} at ${fixture.company} to ${STAGE_SUMMARY[fixture.to]}`
}

export function countChangedLines(hunks: readonly DiffHunk[]) {
  return hunks.reduce(
    (count, hunk) =>
      count + hunk.lines.filter((line) => line.kind !== "eq").length,
    0
  )
}

export function collapsedHunks(
  hunks: readonly DiffHunk[],
  maxChanged = 3
): DiffHunk[] {
  let remaining = maxChanged
  const out: DiffHunk[] = []
  for (const hunk of hunks) {
    if (remaining <= 0) break
    const lines: DiffLine[] = []
    for (const line of hunk.lines) {
      if (line.kind === "eq") {
        if (lines.length > 0) lines.push(line)
        continue
      }
      if (remaining <= 0) break
      lines.push(line)
      remaining -= 1
    }
    if (lines.length > 0) out.push({ section: hunk.section, lines })
  }
  return out
}
