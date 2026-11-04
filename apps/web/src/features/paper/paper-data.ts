import {
  PAPER_KIND_LABEL,
  STARTER_CV_NAME,
  LEGACY_STARTER_CV_PERSON_NAME,
  emptyProofDocument,
  isProofDocument,
  type PaperContentKind,
  type PaperDoc,
  type PaperDocStatus,
} from "@workspace/domain"

import { SAMPLE_AUTHOR } from "@/features/seed/sample-author.ts"

import type { ProofData } from "./paper-proof-types.ts"

export type DocType = PaperContentKind
export type DocStatus = PaperDocStatus
export type { PaperDoc }

export const TYPE_LABEL = PAPER_KIND_LABEL

export function profileFirstName(profile: { name: string } = SAMPLE_AUTHOR) {
  return profile.name.trim().split(/\s+/).filter(Boolean)[0] ?? profile.name
}

export function proofContentOf(doc: PaperDoc): ProofData {
  if (doc.kind === "proof" && isProofDocument(doc.content)) return doc.content
  return emptyProofDocument()
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

export const PAPER_LINKED_EMPTY_HINT = "So Apply knows which CV goes with it."

export const PAPER_ATTACH_SAMPLE_CTA = "Attach Sample CV to a Job"
export const PAPER_ATTACH_CV_CTA = "Attach CV to a Job"

export function isSampleCv(doc: PaperDoc) {
  return doc.kind === "cv" && doc.name === STARTER_CV_NAME
}

export function isStarterCvPersonName(name: string) {
  return (
    name.trim().toLowerCase() === LEGACY_STARTER_CV_PERSON_NAME.toLowerCase()
  )
}

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

export type PaperZeroStateId = "cv" | "letter" | "proof" | "linked"

export type PaperZeroState = {
  id: PaperZeroStateId
  title: string
  hint: string
}

export const PAPER_ZERO_STATES = {
  cv: { title: "Start a CV", hint: "Pick a template and fill it in." },
  letter: { title: "Start a Letter", hint: "Write to one Job." },
  proof: { title: "Add a Proof", hint: "Show one thing you made." },
} as const

export function paperZeroStates(
  docs: readonly PaperDoc[],
  canLink: boolean
): PaperZeroState[] {
  const states: PaperZeroState[] = []
  for (const kind of ["cv", "letter", "proof"] as const) {
    if (!docs.some((doc) => doc.kind === kind)) {
      states.push({ id: kind, ...PAPER_ZERO_STATES[kind] })
    }
  }
  const attach = paperLinkedEmptyCta(docs)
  if (attach && canLink && !docs.some((doc) => doc.applyCardId)) {
    states.push({ id: "linked", title: attach, hint: PAPER_LINKED_EMPTY_HINT })
  }
  return states
}
