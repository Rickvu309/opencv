import {
  COACH_HISTORY_CHAR_BUDGET,
  COACH_HISTORY_MESSAGE_CAP,
  COACH_WORKSPACE_LIST_CAP,
  PAPER_KIND_LABEL,
  isDemoPitchDocument,
  isPitchDocument,
  type ApplyCard,
  type CoachFocusDoc,
  type CoachSelection,
  type PaperDoc,
  type ThreadMessage,
  type UserProfile,
} from "@workspace/domain"

import {
  describeFocusDoc,
  isPaperEditAsk,
  mustEditTurnInstruction,
} from "./must-edit.js"
import { isPitchCoachAsk, pitchScopeTurnInstruction } from "./pitch-scope.js"

export type WorkspacePaperItem = {
  name: string
  kind: PaperDoc["kind"]
  status: PaperDoc["status"]
}

export type WorkspaceApplyItem = {
  title: string
  company: string
  stage: ApplyCard["stage"]
  starred: boolean
}

export type WorkspacePitchItem = {
  published: boolean
  demo: boolean
  headline: string
  achievements: number
  experience: number
  highlights: number
}

export type WorkspaceSnapshot = {
  profileName: string | null
  paper: WorkspacePaperItem[]
  apply: WorkspaceApplyItem[]
  /** Present when the runtime loaded Pitch; omit in unit fixtures. */
  pitch?: WorkspacePitchItem | null
  focusDoc?: CoachFocusDoc
}

export type WindowedMessage = {
  role: "user" | "assistant"
  content: string
}

const STAGE_LABEL: Record<ApplyCard["stage"], string> = {
  inbox: "Inbox",
  prep: "Prep",
  sent: "Sent",
  live: "Live",
  closed: "Closed",
}

const STATUS_LABEL: Record<PaperDoc["status"], string> = {
  draft: "draft",
  ready: "ready",
  published: "published",
}

/**
 * PRODUCT.md voice: grounded mentor, evidence over encouragement,
 * exactly one next step, honest about distance, no exclamation marks.
 */
export function personaSystemPrompt(): string {
  return [
    "You are the Coach in OpenPath. You are a grounded mentor for an early-career User: warm, honest, and willing to push back with evidence. You encourage without flattering. You do not hype, gamify, or sound like corporate HR.",
    "",
    "Voice:",
    "- English. Second person. Contractions are fine.",
    "- Never use exclamation marks.",
    "- Evidence over encouragement. Cite what you actually read or did — a Paper document, an Apply card, a Profile field, or a tool result. Do not invent workspace facts.",
    "- Give exactly one next step in every reply. Make it concrete.",
    "- Be honest about distance. If the gap to a goal is large, say so plainly.",
    "- Never claim an action succeeded unless the tool result was ok. Say failures plainly.",
    "",
    "How you work:",
    "- A compact workspace snapshot is below. Use read tools for ids, content, and anything not listed.",
    "- You act through tools. Reads do not change state. Mutations run the same Commands the User can run.",
    "- Read before you advise when the snapshot is not enough. Act when the User asked for an outcome you can do.",
    "- Never invent ids. List or read first, then use the real UUID from the tool result. A Pitch or café advice ask is not consent to change an Apply card.",
    "- Do not mutate Apply, Paper, or Pitch unless the User asked for that change. Asking to change, rewrite, shorten, tailor, sharpen, or fix content is that ask — run the Command in the same turn.",
    "- When the User selected text, prefer editing that selection. Do not rewrite the rest of the document unless they asked. When there is no selection, use the named section or the open document outline.",
    "- When the User asks to change, rewrite, shorten, tailor, sharpen, or fix content in the open document or a Paper document they name, you must attempt paper_updateContent. If the open document JSON is already in this prompt, call paper_updateContent immediately — do not call paper_getDoc first. Read with paper_listDocs or paper_getDoc only when you still need an id. Use paper_createDoc when they asked for a new document. A prose-only reply is allowed only after a failed tool receipt: one plain line on what failed, then one next step. Never tell them to paste the rewrite themselves. Never ask whether to apply.",
  ].join("\n")
}

export function summarizeWorkspace(
  snapshot: WorkspaceSnapshot,
  listCap = COACH_WORKSPACE_LIST_CAP
): string {
  const starred = snapshot.apply.filter((card) => card.starred).length
  const paperLines = cappedLines(
    snapshot.paper.map(
      (doc) =>
        `- ${doc.name} · ${PAPER_KIND_LABEL[doc.kind]} · ${STATUS_LABEL[doc.status]}`
    ),
    listCap
  )
  const applyLines = cappedLines(
    snapshot.apply.map((card) => {
      const star = card.starred ? " · starred" : ""
      return `- ${card.title} · ${card.company} · ${STAGE_LABEL[card.stage]}${star}`
    }),
    listCap
  )

  const lines = [
    "Workspace snapshot (counts and a short list; use tools for detail):",
    `Profile: ${snapshot.profileName ?? "unknown"}`,
    `Paper: ${countLabel(snapshot.paper.length, "document")}`,
    ...paperLines,
    `Apply: ${countLabel(snapshot.apply.length, "card")}${
      snapshot.apply.length > 0 ? ` (${starred} starred)` : ""
    }`,
    ...applyLines,
  ]

  if (snapshot.pitch !== undefined) {
    lines.push(summarizePitch(snapshot.pitch))
  }

  if (snapshot.focusDoc) {
    lines.push(describeFocusDoc(snapshot.focusDoc))
  }

  return lines.join("\n")
}

export function historyForRegenerate(messages: readonly ThreadMessage[]): {
  history: ThreadMessage[]
  priorCoach: ThreadMessage | undefined
} {
  const last = messages[messages.length - 1]
  if (last?.role === "coach") {
    return { history: messages.slice(0, -1), priorCoach: last }
  }
  return { history: [...messages], priorCoach: undefined }
}

export function regenerateInstruction(priorCoach?: ThreadMessage): string {
  const lines = [
    "The User asked you to regenerate your last reply. Write a fresh answer to their latest message.",
    "Commands already run in this Thread remain facts. Do not claim they were reversed or undone.",
  ]
  const receipts =
    priorCoach?.parts?.filter((part) => part.type === "tool") ?? []
  if (receipts.length > 0) {
    lines.push("Receipts from the previous turn:")
    for (const part of receipts) {
      const flag = part.ok ? "ok" : "fail"
      lines.push(`- [${part.name} ${flag}] ${part.summary}`)
    }
  }
  return lines.join("\n")
}

export function selectionInstruction(selection?: CoachSelection): string | null {
  if (!selection?.text) return null
  const where = selection.sectionId
    ? ` in section "${selection.sectionId}"`
    : ""
  return [
    `The User has selected text${where} in the open Paper document. Prefer editing that selection rather than rewriting the whole document.`,
    `Selection:\n"""\n${selection.text}\n"""`,
  ].join("\n")
}

export function assembleSystemPrompt(
  snapshot: WorkspaceSnapshot,
  listCap = COACH_WORKSPACE_LIST_CAP,
  options?: {
    regenerateFrom?: ThreadMessage
    selection?: CoachSelection
    latestUserText?: string
  }
): string {
  const parts = [personaSystemPrompt(), summarizeWorkspace(snapshot, listCap)]
  const selected = selectionInstruction(options?.selection)
  if (selected) parts.push(selected)
  if (options?.regenerateFrom) {
    parts.push(regenerateInstruction(options.regenerateFrom))
  }
  const userText = options?.latestUserText?.trim() ?? ""
  if (userText && isPaperEditAsk(userText, Boolean(snapshot.focusDoc))) {
    parts.push(mustEditTurnInstruction(Boolean(snapshot.focusDoc)))
  }
  if (userText && isPitchCoachAsk(userText)) {
    parts.push(pitchScopeTurnInstruction())
  }
  return parts.join("\n\n")
}

export function flattenMessage(message: ThreadMessage): string {
  if (message.parts && message.parts.length > 0) {
    return message.parts
      .map((part) => {
        if (part.type === "text") return part.text
        const flag = part.ok ? "ok" : "fail"
        return `[${part.name} ${flag}] ${part.summary}`
      })
      .filter((line) => line.length > 0)
      .join("\n")
  }
  return message.text
}

export function windowHistory(
  messages: readonly ThreadMessage[],
  options?: {
    maxMessages?: number
    charBudget?: number
  }
): WindowedMessage[] {
  const maxMessages = options?.maxMessages ?? COACH_HISTORY_MESSAGE_CAP
  const charBudget = options?.charBudget ?? COACH_HISTORY_CHAR_BUDGET
  const recent = messages.slice(-maxMessages)
  const flattened: WindowedMessage[] = recent.map((message) => ({
    role: message.role === "user" ? "user" : "assistant",
    content: flattenMessage(message),
  }))

  const kept: WindowedMessage[] = []
  let used = 0
  for (let index = flattened.length - 1; index >= 0; index -= 1) {
    const message = flattened[index]
    if (!message) continue
    const next = used + message.content.length
    if (kept.length > 0 && next > charBudget) break
    if (kept.length === 0 && message.content.length > charBudget) {
      kept.unshift({
        ...message,
        content: message.content.slice(0, charBudget),
      })
      break
    }
    kept.unshift(message)
    used = next
  }
  return kept
}

export function snapshotFromLists(input: {
  profile?: UserProfile | null
  paper: PaperDoc[]
  apply: ApplyCard[]
  pitch?: unknown
  focusDoc?: CoachFocusDoc
}): WorkspaceSnapshot {
  return {
    profileName: input.profile?.name ?? null,
    paper: input.paper.map((doc) => ({
      name: doc.name,
      kind: doc.kind,
      status: doc.status,
    })),
    apply: input.apply.map((card) => ({
      title: card.title,
      company: card.company,
      stage: card.stage,
      starred: card.starred,
    })),
    ...(input.pitch !== undefined
      ? { pitch: pitchItemFromDocument(input.pitch) }
      : {}),
    ...(input.focusDoc ? { focusDoc: input.focusDoc } : {}),
  }
}

export function pitchItemFromDocument(
  content: unknown
): WorkspacePitchItem | null {
  if (!isPitchDocument(content)) return null
  return {
    published: content.published,
    demo: isDemoPitchDocument(content),
    headline: content.headline.trim(),
    achievements: content.achievements.length,
    experience: content.experience.length,
    highlights: content.storyHighlights.length,
  }
}

function summarizePitch(pitch: WorkspacePitchItem | null): string {
  if (!pitch) return "Pitch: none"
  const kind = pitch.demo ? "sample page" : "page"
  const published = pitch.published ? "published" : "unpublished"
  const headline = pitch.headline ? ` · ${pitch.headline}` : " · no headline"
  return `Pitch: ${kind} · ${published}${headline} · ${countLabel(pitch.achievements, "achievement")} · ${countLabel(pitch.experience, "experience")} · ${countLabel(pitch.highlights, "moment")}`
}

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function cappedLines(lines: string[], cap: number): string[] {
  if (lines.length === 0) return []
  if (lines.length <= cap) return lines
  return [...lines.slice(0, cap), `(+${lines.length - cap} more)`]
}
