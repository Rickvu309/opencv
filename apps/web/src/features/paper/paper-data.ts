import {
  PAPER_KIND_LABEL,
  emptyCvDocument,
  emptyProofDocument,
  isCvDocument,
  isLetterDocument,
  isProofDocument,
  type PaperContentKind,
  type PaperDoc,
  type PaperDocStatus,
} from "@workspace/domain"

import {
  SAMPLE_AUTHOR,
  type SampleAuthor,
} from "@/features/seed/sample-author.ts"

import type { CvData } from "./paper-cv-types.ts"
import type { ProofData } from "./paper-proof-types.ts"

export type DocType = PaperContentKind
export type DocStatus = PaperDocStatus
export type { PaperDoc }

export const TYPE_LABEL = PAPER_KIND_LABEL

export function profileFirstName(profile: SampleAuthor = SAMPLE_AUTHOR) {
  return profile.name.trim().split(/\s+/).filter(Boolean)[0] ?? profile.name
}

export function cvContentOf(doc: PaperDoc): CvData {
  if (doc.kind === "cv" && isCvDocument(doc.content)) return doc.content
  return emptyCvDocument()
}

export function proofContentOf(doc: PaperDoc): ProofData {
  if (doc.kind === "proof" && isProofDocument(doc.content)) return doc.content
  return emptyProofDocument()
}

export function letterMarkdownOf(doc: PaperDoc): string {
  if (doc.kind === "letter" && isLetterDocument(doc.content)) {
    return doc.content.markdown
  }
  return ""
}

export function formatPaperUpdated(iso: string, now = Date.now()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso

  const deltaMs = now - then
  if (deltaMs < 45_000) return "Just now"
  if (deltaMs < 50 * 60_000) {
    const minutes = Math.max(1, Math.round(deltaMs / 60_000))
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`
  }

  const today = new Date(now)
  const date = new Date(then)
  const startOfToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  )
  const startOfThen = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  )
  const dayDiff = Math.round((startOfToday - startOfThen) / 86_400_000)
  if (dayDiff === 0) return "Today"
  if (dayDiff === 1) return "Yesterday"

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function statusHint(docs: PaperDoc[]): string {
  if (docs.length === 0) return "None yet"
  const drafts = docs.filter((doc) => doc.status === "draft").length
  const ready = docs.filter((doc) => doc.status === "ready").length
  if (drafts === docs.length) {
    return docs.length === 1 ? "1 draft" : "All drafts"
  }
  if (ready === docs.length) {
    return docs.length === 1 ? "1 ready" : "All ready"
  }
  const parts = []
  if (drafts) parts.push(`${drafts} draft${drafts === 1 ? "" : "s"}`)
  if (ready) parts.push(`${ready} ready`)
  return parts.join(" · ") || "Mixed"
}

export function paperSummary(docs: PaperDoc[]) {
  const cvs = docs.filter((doc) => doc.kind === "cv")
  const letters = docs.filter((doc) => doc.kind === "letter")
  const proofs = docs.filter((doc) => doc.kind === "proof")
  return [
    { label: "CVs", value: String(cvs.length), hint: statusHint(cvs) },
    {
      label: "Letters",
      value: String(letters.length),
      hint: statusHint(letters),
    },
    { label: "Proof", value: String(proofs.length), hint: statusHint(proofs) },
    {
      label: "Linked to Apply",
      value: String(docs.filter((doc) => doc.applyCardId).length),
      hint:
        docs.filter((doc) => doc.applyCardId).length === 0
          ? "None yet"
          : "Linked to an Opportunity",
    },
  ]
}
