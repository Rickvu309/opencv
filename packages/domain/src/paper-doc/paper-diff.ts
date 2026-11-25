import type { PaperChange } from "./changes.js"
import type { PaperContentKind } from "./paper.js"
import { isProofDocument, type ProofDocument } from "./paper.js"

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

export function diffPaperContent(
  kind: PaperContentKind,
  before: unknown,
  after: unknown
): DiffHunk[] {
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
