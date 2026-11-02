import { blocksToCvCodec } from "./paper-blocks/codec.js"
import { isCvBlockDocument } from "./paper-blocks/document.js"
import { blocksToPreviewModel } from "./paper-blocks/preview.js"
import {
  isCvDocument,
  isLetterDocument,
  isProofDocument,
  LETTER_PARTS,
  type CvDocument,
  type LetterDocument,
  type LetterPart,
  type ProofDocument,
} from "./paper-codecs.js"
import type { PaperChange } from "./paper-doc/changes.js"
import type { PaperContentKind } from "./paper.js"

type DiffLineKind = "eq" | "del" | "add"

type DiffLine = {
  kind: DiffLineKind
  text: string
}

export type DiffHunk = {
  section: string
  sectionId: string
  lines: DiffLine[]
}

const LINE_CAP = 180

function truncateDiffLine(text: string, cap = LINE_CAP) {
  const trimmed = text.replace(/\s+/g, " ").trim()
  if (trimmed.length <= cap) return trimmed
  return `${trimmed.slice(0, cap - 1).trimEnd()}…`
}

function fieldHunk(
  section: string,
  sectionId: string,
  before: string,
  after: string
): DiffHunk | null {
  if (before === after) return null
  const lines: DiffLine[] = []
  if (before) lines.push({ kind: "del", text: truncateDiffLine(before) })
  if (after) lines.push({ kind: "add", text: truncateDiffLine(after) })
  if (lines.length === 0) return null
  return { section, sectionId, lines }
}

function diffCv(before: CvDocument, after: CvDocument): DiffHunk[] {
  const hunks: DiffHunk[] = []
  const push = (hunk: DiffHunk | null) => {
    if (hunk) hunks.push(hunk)
  }

  push(fieldHunk("Name", "name", before.name, after.name))
  push(fieldHunk("Headline", "headline", before.headline, after.headline))
  push(fieldHunk("Summary", "summary", before.summary, after.summary))

  const expCount = Math.max(before.experience.length, after.experience.length)
  for (let index = 0; index < expCount; index += 1) {
    const prev = before.experience[index]
    const next = after.experience[index]
    const label = `Experience · ${next?.company || prev?.company || "role"}`
    const sectionId = `experience-${index}`
    if (!prev && next) {
      push(
        fieldHunk(
          label,
          sectionId,
          "",
          [next.role, next.company, ...next.bullets].filter(Boolean).join(" · ")
        )
      )
      continue
    }
    if (prev && !next) {
      push(
        fieldHunk(
          label,
          sectionId,
          [prev.role, prev.company, ...prev.bullets]
            .filter(Boolean)
            .join(" · "),
          ""
        )
      )
      continue
    }
    if (!prev || !next) continue
    const bulletCount = Math.max(prev.bullets.length, next.bullets.length)
    const lines: DiffLine[] = []
    if (prev.role !== next.role || prev.company !== next.company) {
      if (prev.role || prev.company) {
        lines.push({
          kind: "del",
          text: truncateDiffLine(`${prev.role} · ${prev.company}`),
        })
      }
      if (next.role || next.company) {
        lines.push({
          kind: "add",
          text: truncateDiffLine(`${next.role} · ${next.company}`),
        })
      }
    }
    for (let bi = 0; bi < bulletCount; bi += 1) {
      const left = prev.bullets[bi] ?? ""
      const right = next.bullets[bi] ?? ""
      if (left === right) {
        if (left) lines.push({ kind: "eq", text: truncateDiffLine(left) })
        continue
      }
      if (left) lines.push({ kind: "del", text: truncateDiffLine(left) })
      if (right) lines.push({ kind: "add", text: truncateDiffLine(right) })
    }
    if (lines.some((line) => line.kind !== "eq")) {
      hunks.push({ section: label, sectionId, lines })
    }
  }

  const eduCount = Math.max(before.education.length, after.education.length)
  for (let index = 0; index < eduCount; index += 1) {
    const prev = before.education[index]
    const next = after.education[index]
    push(
      fieldHunk(
        `Education · ${next?.school || prev?.school || "school"}`,
        `education-${index}`,
        prev
          ? [prev.school, prev.degree, prev.detail].filter(Boolean).join(" · ")
          : "",
        next
          ? [next.school, next.degree, next.detail].filter(Boolean).join(" · ")
          : ""
      )
    )
  }

  return hunks
}

const LETTER_PART_LABELS: Record<LetterPart, string> = {
  sender: "Sender",
  contact: "Contact",
  date: "Date",
  recipient: "Recipient",
  salutation: "Salutation",
  closing: "Closing",
  signature: "Signature",
}

function diffLetterBody(before: string, after: string): DiffHunk[] {
  if (before === after) return []
  const prevParas = before
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  const nextParas = after
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  const count = Math.max(prevParas.length, nextParas.length, 1)
  const hunks: DiffHunk[] = []
  for (let index = 0; index < count; index += 1) {
    const hunk = fieldHunk(
      index === 0 ? "Opening" : `Paragraph ${index + 1}`,
      "letter",
      prevParas[index] ?? "",
      nextParas[index] ?? ""
    )
    if (hunk) hunks.push(hunk)
  }
  return hunks
}

function diffLetter(before: LetterDocument, after: LetterDocument): DiffHunk[] {
  const hunks: DiffHunk[] = []
  const pushPart = (part: LetterPart) => {
    const hunk = fieldHunk(
      LETTER_PART_LABELS[part],
      `letter-${part}`,
      (before[part] ?? "").trim(),
      (after[part] ?? "").trim()
    )
    if (hunk) hunks.push(hunk)
  }
  for (const part of LETTER_PARTS) {
    if (part === "closing")
      hunks.push(...diffLetterBody(before.markdown, after.markdown))
    pushPart(part)
  }
  return hunks
}

function proofStepLabel(type: string) {
  if (type === "context") return "Context"
  if (type === "action") return "What I did"
  if (type === "outcome") return "Outcome"
  return "Note"
}

function diffProof(before: ProofDocument, after: ProofDocument): DiffHunk[] {
  const hunks: DiffHunk[] = []
  const title = fieldHunk("Title", "proof-title", before.title, after.title)
  if (title) hunks.push(title)

  const byId = new Map(before.steps.map((step) => [step.id, step]))
  const seen = new Set<string>()
  for (const step of after.steps) {
    seen.add(step.id)
    const prev = byId.get(step.id)
    const hunk = fieldHunk(
      step.title || proofStepLabel(step.type),
      `proof-step-${step.id}`,
      prev ? prev.body : "",
      step.body
    )
    if (hunk) hunks.push(hunk)
  }
  for (const step of before.steps) {
    if (seen.has(step.id)) continue
    const hunk = fieldHunk(
      step.title || proofStepLabel(step.type),
      `proof-step-${step.id}`,
      step.body,
      ""
    )
    if (hunk) hunks.push(hunk)
  }
  return hunks
}

function cvSide(value: unknown): CvDocument | null {
  if (isCvBlockDocument(value)) return blocksToCvCodec(value)
  if (isCvDocument(value)) return value
  return null
}

function carriedLines(value: unknown, kind: "activities" | "awards"): string[] {
  if (!isCvBlockDocument(value)) return []
  return blocksToPreviewModel(value)[kind]
}

function lineHunks(
  section: string,
  sectionId: string,
  before: readonly string[],
  after: readonly string[]
): DiffHunk[] {
  const hunks: DiffHunk[] = []
  const count = Math.max(before.length, after.length)
  for (let index = 0; index < count; index += 1) {
    const hunk = fieldHunk(
      section,
      `${sectionId}-${index}`,
      before[index] ?? "",
      after[index] ?? ""
    )
    if (hunk) hunks.push(hunk)
  }
  return hunks
}

export function diffPaperContent(
  kind: PaperContentKind,
  before: unknown,
  after: unknown
): DiffHunk[] {
  if (kind === "cv") {
    const beforeCv = cvSide(before)
    const afterCv = cvSide(after)
    if (beforeCv && afterCv) {
      return [
        ...diffCv(beforeCv, afterCv),
        ...lineHunks(
          "Activities",
          "activities",
          carriedLines(before, "activities"),
          carriedLines(after, "activities")
        ),
        ...lineHunks(
          "Awards",
          "awards",
          carriedLines(before, "awards"),
          carriedLines(after, "awards")
        ),
      ]
    }
  }
  if (
    kind === "letter" &&
    isLetterDocument(before) &&
    isLetterDocument(after)
  ) {
    return diffLetter(before, after)
  }
  if (kind === "proof" && isProofDocument(before) && isProofDocument(after)) {
    return diffProof(before, after)
  }
  return []
}

export function countChangedLines(hunks: readonly DiffHunk[]): number {
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
    if (lines.length > 0)
      out.push({ section: hunk.section, sectionId: hunk.sectionId, lines })
  }
  return out
}

const CHANGE_LABEL: Record<PaperChange["change"], string> = {
  added: "Added",
  changed: "Changed",
  moved: "Moved",
  removed: "Removed",
}

export function changeHunks(changes: readonly PaperChange[]): DiffHunk[] {
  return changes.map((change) => {
    const lines: DiffLine[] = []
    if (change.before) {
      lines.push({ kind: "del", text: truncateDiffLine(change.before) })
    }
    if (change.after) {
      lines.push({
        kind: change.change === "moved" ? "eq" : "add",
        text: truncateDiffLine(change.after),
      })
    }
    return {
      section: `${CHANGE_LABEL[change.change]} ${change.kind}`,
      sectionId: change.blockId,
      lines,
    }
  })
}
