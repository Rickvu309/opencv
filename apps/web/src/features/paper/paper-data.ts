import {
  PAPER_KIND_LABEL,
  STARTER_CV_NAME,
  STARTER_CV_PERSON_NAME,
  emptyCvDocument,
  emptyProofDocument,
  isCvDocument,
  isLetterDocument,
  isProofDocument,
  type PaperContentKind,
  type PaperDoc,
  type PaperDocStatus,
} from "@workspace/domain"

import { SAMPLE_AUTHOR } from "@/features/seed/sample-author.ts"

import type { CvData } from "./paper-cv-types.ts"
import type { ProofData } from "./paper-proof-types.ts"

export type DocType = PaperContentKind
export type DocStatus = PaperDocStatus
export type { PaperDoc }

export const TYPE_LABEL = PAPER_KIND_LABEL

export function profileFirstName(profile: { name: string } = SAMPLE_AUTHOR) {
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

export const SAMPLE_CV_LABEL = "Sample · replace anytime"
export const SAMPLE_CV_MAKE_MINE = "Make mine"
export const OWNED_CV_NAME = "My internship CV"

/** One-sentence value for the Linked to Apply empty tile. */
export const PAPER_LINKED_EMPTY_HINT =
  "So Apply knows which CV goes with a job."

export const PAPER_ATTACH_SAMPLE_CTA = "Attach Sample CV to a live job"
export const PAPER_ATTACH_CV_CTA = "Attach CV to a live job"

export const PAPER_LIST_EMPTY_CTA = {
  letter: "Start letter",
  proof: "Add proof",
  linked: PAPER_ATTACH_SAMPLE_CTA,
} as const

export function isSampleCv(doc: PaperDoc) {
  return doc.kind === "cv" && doc.name === STARTER_CV_NAME
}

export function isStarterCvPersonName(name: string) {
  return name.trim().toLowerCase() === STARTER_CV_PERSON_NAME.toLowerCase()
}

/** Drive title after the User claims the sample CV. */
export function ownedCvName(
  userName?: string | null,
  personName?: string | null
) {
  const person = personName?.trim() ?? ""
  if (person && !isStarterCvPersonName(person)) {
    return `${profileFirstName({ name: person })}'s CV`
  }
  const user = userName?.trim() ?? ""
  if (user) {
    return `${profileFirstName({ name: user })}'s CV`
  }
  return OWNED_CV_NAME
}

export function sampleCvOf(docs: readonly PaperDoc[]) {
  return docs.find(isSampleCv)
}

export function paperDocToLink(docs: readonly PaperDoc[]) {
  return sampleCvOf(docs) ?? docs.find((doc) => doc.kind === "cv") ?? docs[0]
}

export function paperLinkedEmptyCta(docs: readonly PaperDoc[]): string | null {
  const doc = paperDocToLink(docs)
  if (!doc) return null
  return isSampleCv(doc) ? PAPER_ATTACH_SAMPLE_CTA : PAPER_ATTACH_CV_CTA
}

export type PaperSummaryId = "cvs" | "letters" | "proof" | "linked"

export type PaperSummaryItem = {
  id: PaperSummaryId
  label: string
  value: string
  hint: string
  cta: string | null
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

export function paperSummary(docs: PaperDoc[]): PaperSummaryItem[] {
  const cvs = docs.filter((doc) => doc.kind === "cv")
  const letters = docs.filter((doc) => doc.kind === "letter")
  const proofs = docs.filter((doc) => doc.kind === "proof")
  const linked = docs.filter((doc) => doc.applyCardId)
  const onlySampleCv = cvs.length === 1 && cvs[0] !== undefined && isSampleCv(cvs[0])

  return [
    {
      id: "cvs",
      label: "CVs",
      value: String(cvs.length),
      hint: onlySampleCv ? SAMPLE_CV_LABEL : statusHint(cvs),
      cta: null,
    },
    {
      id: "letters",
      label: "Letters",
      value: String(letters.length),
      hint: letters.length === 0 ? "" : statusHint(letters),
      cta: letters.length === 0 ? PAPER_LIST_EMPTY_CTA.letter : null,
    },
    {
      id: "proof",
      label: "Proof",
      value: String(proofs.length),
      hint: proofs.length === 0 ? "" : statusHint(proofs),
      cta: proofs.length === 0 ? PAPER_LIST_EMPTY_CTA.proof : null,
    },
    {
      id: "linked",
      label: "Linked to Apply",
      value: String(linked.length),
      hint:
        linked.length === 0
          ? PAPER_LINKED_EMPTY_HINT
          : "Linked to an Opportunity",
      cta: linked.length === 0 ? paperLinkedEmptyCta(docs) : null,
    },
  ]
}
