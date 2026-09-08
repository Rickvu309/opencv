import type { CoachSelection, ThreadMessagePart } from "@workspace/domain"

import {
  STREAMING_COACH_ID,
  type HomeMessage,
} from "@/features/home/threads.ts"

import type { CoachContextChip } from "./coach-context-chips.ts"
import type { CvData } from "./paper-cv-types.ts"
import type { ProofData } from "./paper-proof-types.ts"

export type PaperCiteSpecificity = "bullet" | "role" | "section"

export type PaperCiteSpan = {
  sectionId: string
  label: string
  text: string
  specificity: PaperCiteSpecificity
}

export type PaperCite = {
  sectionId: string
  label: string
}

const SPECIFICITY_RANK: Record<PaperCiteSpecificity, number> = {
  bullet: 3,
  role: 2,
  section: 1,
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "your",
  "you",
  "was",
  "are",
  "but",
  "not",
  "have",
  "from",
  "they",
  "their",
  "about",
  "should",
  "would",
  "could",
  "just",
  "one",
  "next",
  "step",
  "also",
  "can",
  "into",
  "than",
  "then",
  "when",
  "what",
  "how",
  "why",
  "its",
  "our",
  "more",
  "less",
  "very",
  "like",
  "been",
  "were",
  "has",
  "had",
  "did",
  "does",
  "paper",
  "coach",
  "document",
  "section",
  "rewrite",
  "please",
  "help",
  "make",
  "line",
  "text",
  "content",
  "bullet",
  "bullets",
  "role",
  "found",
  "read",
  "weak",
  "change",
])

const MIN_SCORE = 1.15

function clipLabel(value: string, max = 40) {
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

function shortRole(role: string) {
  const parts = role.split("·").map((part) => part.trim()).filter(Boolean)
  return parts[parts.length - 1] || role
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%+]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP.has(token))
}

function uniqueTokens(value: string): string[] {
  return [...new Set(tokenize(value))]
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

function textOverlaps(left: string, right: string) {
  const a = normalize(left)
  const b = normalize(right)
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  const shared = uniqueTokens(a).filter((token) => uniqueTokens(b).includes(token))
  return shared.length >= 3
}

export function paperCiteSpansFromCv(data: CvData): PaperCiteSpan[] {
  const spans: PaperCiteSpan[] = []
  if (data.name.trim()) {
    spans.push({
      sectionId: "name",
      label: "Name",
      text: data.name,
      specificity: "section",
    })
  }
  if (data.headline.trim()) {
    spans.push({
      sectionId: "headline",
      label: "Headline",
      text: data.headline,
      specificity: "section",
    })
  }
  if (data.summary.trim()) {
    spans.push({
      sectionId: "summary",
      label: "Summary",
      text: data.summary,
      specificity: "section",
    })
  }
  data.experience.forEach((item, index) => {
    const roleLabel = `Experience · ${shortRole(item.role)}`
    spans.push({
      sectionId: `experience-${index}`,
      label: clipLabel(roleLabel),
      text: [item.role, item.company, item.period, item.location]
        .filter(Boolean)
        .join(" "),
      specificity: "role",
    })
    item.bullets.forEach((bullet, bi) => {
      if (!bullet.trim()) return
      spans.push({
        sectionId: `experience-${index}-bullet-${bi}`,
        label: clipLabel(roleLabel),
        text: bullet,
        specificity: "bullet",
      })
    })
  })
  data.education.forEach((item, index) => {
    spans.push({
      sectionId: `education-${index}`,
      label: clipLabel(`Education · ${item.school}`),
      text: [item.school, item.degree, item.period, item.detail]
        .filter(Boolean)
        .join(" "),
      specificity: "section",
    })
  })
  const skillText = data.skills.flatMap((group) => group.items).join(" ")
  if (skillText.trim()) {
    spans.push({
      sectionId: "skills",
      label: "Skills",
      text: skillText,
      specificity: "section",
    })
  }
  data.projects?.forEach((project, index) => {
    spans.push({
      sectionId: `project-${index}`,
      label: clipLabel(project.name),
      text: `${project.name} ${project.detail}`,
      specificity: "section",
    })
  })
  return spans
}

export function paperCiteSpansFromProof(data: ProofData): PaperCiteSpan[] {
  const spans: PaperCiteSpan[] = []
  if (data.title.trim()) {
    spans.push({
      sectionId: "proof-title",
      label: clipLabel(data.title),
      text: [data.title, data.subtitle].filter(Boolean).join(" "),
      specificity: "section",
    })
  }
  for (const step of data.steps) {
    spans.push({
      sectionId: `proof-step-${step.id}`,
      label: clipLabel(step.title || "Proof"),
      text: [step.title, step.body].filter(Boolean).join(" "),
      specificity: "section",
    })
  }
  return spans
}

export function paperCiteSpansFromLetter(markdown: string): PaperCiteSpan[] {
  const text = markdown.trim()
  if (!text) return []
  return [
    {
      sectionId: "letter",
      label: "Letter",
      text,
      specificity: "section",
    },
  ]
}

export function paperCiteHunksFromParts(
  parts: readonly ThreadMessagePart[] | undefined
): { sectionId: string; section: string }[] {
  if (!parts) return []
  return parts.flatMap((part) => {
    if (part.type !== "tool" || part.detail?.type !== "paper.updateContent") {
      return []
    }
    return part.detail.hunks.map((hunk) => ({
      sectionId: hunk.sectionId,
      section: hunk.section,
    }))
  })
}

export function previousUserText(
  messages: readonly HomeMessage[],
  coachId: string
): string {
  const index = messages.findIndex((message) => message.id === coachId)
  for (let i = index - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role === "user") return message.text
  }
  return ""
}

function selectionHint(
  chips: readonly CoachContextChip[] | undefined,
  live?: CoachSelection | null
): CoachSelection | undefined {
  const fromChip = chips
    ?.map((chip) => chip.selection)
    .find((selection) => selection?.text)
  if (fromChip?.text) return fromChip
  return live?.text ? live : undefined
}

function citeFromProse(
  ask: string | undefined,
  reply: string,
  spans: readonly PaperCiteSpan[]
): PaperCite | null {
  const query = `${ask ?? ""}\n${reply}`
  const queryTokens = uniqueTokens(query)
  if (queryTokens.length === 0) return null
  const df = documentFrequency(spans)
  const scored = spans.map((span) => ({
    span,
    score: scoreSpan(span, queryTokens, df),
  }))
  const best = pickBest(scored)
  if (!best) return null
  return { sectionId: best.sectionId, label: best.label }
}

function citeFromSelection(
  chips: readonly CoachContextChip[] | undefined,
  live: CoachSelection | null | undefined,
  spans: readonly PaperCiteSpan[]
): PaperCite | null {
  const selection = selectionHint(chips, live)
  if (!selection?.text) return null
  const byId = selection.sectionId
    ? spans.find((span) => span.sectionId === selection.sectionId)
    : undefined
  const byText = spans.find((span) => textOverlaps(span.text, selection.text))
  const match =
    byId ??
    spans.find(
      (span) =>
        span.specificity === "bullet" && textOverlaps(span.text, selection.text)
    ) ??
    byText
  if (!match) return null
  return { sectionId: match.sectionId, label: match.label }
}

function scoreSpan(
  span: PaperCiteSpan,
  queryTokens: readonly string[],
  df: Map<string, number>
) {
  let score = 0
  const spanTokens = new Set(uniqueTokens(span.text))
  for (const token of queryTokens) {
    if (!spanTokens.has(token)) continue
    const freq = df.get(token) ?? 1
    const weight = 1 / freq
    score += weight
    if (token.length >= 6) score += 0.45 * weight
  }
  score += (SPECIFICITY_RANK[span.specificity] - 1) * 0.12
  return score
}

function documentFrequency(spans: readonly PaperCiteSpan[]) {
  const df = new Map<string, number>()
  for (const span of spans) {
    for (const token of uniqueTokens(span.text)) {
      df.set(token, (df.get(token) ?? 0) + 1)
    }
  }
  return df
}

function pickBest(
  scored: { span: PaperCiteSpan; score: number }[]
): PaperCiteSpan | null {
  if (scored.length === 0) return null
  const ranked = [...scored].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return (
      SPECIFICITY_RANK[right.span.specificity] -
      SPECIFICITY_RANK[left.span.specificity]
    )
  })
  const best = ranked[0]
  if (!best || best.score < MIN_SCORE) return null
  if (best.span.specificity === "role") {
    const child = ranked.find(
      (row) =>
        row.span.specificity === "bullet" &&
        row.span.sectionId.startsWith(`${best.span.sectionId}-bullet-`) &&
        row.score >= MIN_SCORE &&
        best.score - row.score <= 0.5
    )
    if (child) return child.span
  }
  const close = ranked.filter((row) => best.score - row.score <= 0.2)
  const specific = [...close].sort(
    (left, right) =>
      SPECIFICITY_RANK[right.span.specificity] -
      SPECIFICITY_RANK[left.span.specificity]
  )[0]
  return specific?.span ?? best.span
}

export function citeFromCoachReply(input: {
  reply: string
  ask?: string
  spans: readonly PaperCiteSpan[]
  chips?: readonly CoachContextChip[]
  selection?: CoachSelection | null
  hunks?: readonly { sectionId: string; section: string }[]
}): PaperCite | null {
  const { spans } = input
  if (spans.length === 0) return null

  const hunk = input.hunks?.find((item) =>
    spans.some((span) => span.sectionId === item.sectionId)
  )
  if (hunk) {
    const span =
      spans.find(
        (item) =>
          item.sectionId === hunk.sectionId && item.specificity === "role"
      ) ?? spans.find((item) => item.sectionId === hunk.sectionId)
    if (span) return { sectionId: span.sectionId, label: span.label }
  }

  return (
    citeFromProse(input.ask, input.reply, spans) ??
    citeFromSelection(input.chips, input.selection, spans)
  )
}

export function citeForCoachMessage(
  message: HomeMessage,
  messages: readonly HomeMessage[],
  spans: readonly PaperCiteSpan[],
  extras?: {
    chips?: readonly CoachContextChip[]
    selection?: CoachSelection | null
  }
): PaperCite | null {
  if (message.role !== "coach" || message.id === STREAMING_COACH_ID) return null
  if (!message.text.trim()) return null
  return citeFromCoachReply({
    reply: message.text,
    ask: previousUserText(messages, message.id),
    spans,
    chips: extras?.chips,
    selection: extras?.selection,
    hunks: paperCiteHunksFromParts(message.parts),
  })
}
