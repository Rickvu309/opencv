/**
 * Pitch café asks (Home "Polish Pitch", share-the-link, what to put on Pitch)
 * must stay coaching. Free models otherwise invent an Apply card id and
 * dead-end on "That card id isn't valid" (QVE-247).
 */

export const APPLY_MUTATION_TOOL_NAMES = [
  "apply_createCard",
  "apply_moveCard",
  "apply_updateCard",
  "apply_toggleStar",
  "paper_linkApplyCard",
] as const

export type ApplyMutationToolName = (typeof APPLY_MUTATION_TOOL_NAMES)[number]

const APPLY_MUTATION_TOOL_SET = new Set<string>(APPLY_MUTATION_TOOL_NAMES)

/** Product Pitch surface — not "applying" / "application". */
const PITCH_SURFACE =
  /\bpitch(?:\s+page)?\b|\bpolish(?:ing)?\s+(?:my\s+)?pitch\b|\bshare(?:able)?\s+(?:the\s+)?(?:pitch\s+)?link\b/i

/**
 * Explicit consent to change an Apply card. Advice about inbox / this week
 * is not that ask.
 */
const APPLY_CARD_MUTATE =
  /\b(?:move|moved|moving|star|starred|starring|unstar|create|created|creating|update|updated|updating|delete|deleted)\b[\s\S]{0,80}\b(?:apply(?:\s+card)?|card|inbox|starred(?:\s+role)?)\b|\b(?:apply(?:\s+card)?|card|starred(?:\s+role)?)\b[\s\S]{0,80}\b(?:to\s+(?:inbox|prep|sent|live|closed)|star|unstar|move)\b/i

export function isApplyCardMutateAsk(text: string): boolean {
  return APPLY_CARD_MUTATE.test(text.trim())
}

/**
 * Home Pitch café / share-link advice. Not an Apply mutate, not a Paper edit.
 */
export function isPitchCoachAsk(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (!PITCH_SURFACE.test(trimmed)) return false
  return !isApplyCardMutateAsk(trimmed)
}

export function isApplyMutationTool(name: string): boolean {
  return APPLY_MUTATION_TOOL_SET.has(name)
}

export function pitchScopeTurnInstruction(): string {
  return [
    "This User message is about Pitch, not Apply.",
    "Do not call apply_createCard, apply_moveCard, apply_updateCard, apply_toggleStar, or paper_linkApplyCard.",
    "Do not invent Apply card ids.",
    "Coach from the Pitch snapshot: what to keep, what to replace, and one next step.",
    "If Pitch detail is missing, say so honestly. A prose reply is the success path.",
  ].join(" ")
}

export function omitApplyMutations<T extends Record<string, unknown>>(
  surface: T,
  pitchScoped: boolean
): T {
  if (!pitchScoped) return surface
  const next = { ...surface }
  for (const name of APPLY_MUTATION_TOOL_NAMES) {
    delete next[name]
  }
  return next
}
