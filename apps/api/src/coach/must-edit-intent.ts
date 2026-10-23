export const MUST_EDIT_TOOLS = {
  updateContent: "paper_updateContent",
  getDoc: "paper_getDoc",
  listDocs: "paper_listDocs",
} as const

export type MustEditToolName =
  (typeof MUST_EDIT_TOOLS)[keyof typeof MUST_EDIT_TOOLS]

export type MustEditToolChoice = {
  type: "tool"
  toolName: MustEditToolName
}

export type MustEditPrepareStep = {
  toolChoice?: MustEditToolChoice
  activeTools?: MustEditToolName[]
}

const EDIT_VERB =
  /\b(?:rewrite|rewrote|rewriting|shorten|shortened|shortening|tailor|tailored|tailoring|sharpen|sharpened|sharpening|edit|edited|editing|fix(?:ing)?(?:\s+(?:the|this|my|tone|spelling|typo))?|make\s+(?:my|the|this)\s+(?:summary|bullet|opening|cv|letter|proof)|make\b.{0,48}(?:shorter|stronger|better|tighter|less)|add\s+a\s+metric|update\s+(?:the|this|my)\s+(?:summary|bullet|cv|letter|proof|opening)|apply\s+(?:this|the|that)\s+(?:rewrite|edit|change))\b/i

const STRONG_EDIT_VERB =
  /\b(?:rewrite|rewrote|rewriting|shorten|shortened|shortening|tailor|tailored|tailoring|sharpen|sharpened|sharpening|make\s+(?:my|the|this)\s+(?:summary|bullet|opening|cv|letter|proof)|make\b.{0,48}(?:shorter|stronger|better|tighter|less)|add\s+a\s+metric|update\s+(?:the|this|my)\s+(?:summary|bullet|cv|letter|proof|opening)|apply\s+(?:this|the|that)\s+(?:rewrite|edit|change))\b/i

const PAPER_NOUN =
  /\b(?:cv|letter|proof|document|summary|bullet|resume|cover|experience|opening|tone|spelling)\b/i

const PAPER_OR_DEIXIS =
  /\b(?:cv|letter|proof|document|summary|bullet|resume|cover|experience|opening|tone|spelling|this|that)\b/i

const ADVICE_INTERROGATIVE =
  /^(?:how\b|what\b|why\b|do\s+i\b|is\s+(?:it|that)\b)|(?:^|\b)should\s+i\b/i

const POLITE_QUESTION = /^(?:can|could|would|will)\s+you\b/i

/**
 * An edit/rewrite ask on the open Paper doc, or a named Paper artifact.
 * How-to / should-I advice is not that ask — even when a focus doc is open.
 * Home advice without a Paper noun stays out — that is not must-edit.
 */
export function isPaperEditAsk(text: string, hasFocusDoc = false): boolean {
  const trimmed = text.trim()
  if (!trimmed || !EDIT_VERB.test(trimmed)) return false
  if (isAdviceInterrogative(trimmed)) return false
  if (isWeakQuestionWithoutPaper(trimmed)) return false
  if (hasFocusDoc) return true
  return PAPER_NOUN.test(trimmed)
}

function isAdviceInterrogative(text: string): boolean {
  return ADVICE_INTERROGATIVE.test(text)
}

function isQuestion(text: string): boolean {
  return text.endsWith("?") || POLITE_QUESTION.test(text)
}

/** "Can you fix my interview nerves?" — edit/fix in a question, no Paper target. */
function isWeakQuestionWithoutPaper(text: string): boolean {
  if (!isQuestion(text)) return false
  if (STRONG_EDIT_VERB.test(text)) return false
  return !PAPER_OR_DEIXIS.test(text)
}

export function latestUserText(
  messages: readonly { role: string; content?: string }[]
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === "user" && typeof message.content === "string") {
      return message.content
    }
  }
  return ""
}

export function mustEditTurnInstruction(hasFocusDoc: boolean): string {
  if (hasFocusDoc) {
    return [
      "This User message is an edit ask on the open Paper document.",
      "Call paper_updateContent in this turn. The open document's current JSON is in the workspace snapshot — copy it, change only what they asked, and send docId, contentVersion, and the full content object.",
      "Do not call paper_getDoc or paper_listDocs first. Do not write the rewrite as prose first. Never ask whether to apply. Never tell the User to paste.",
      "If a named bullet or section is missing, say that in one line and name what is actually in the document, then update the closest matching section they clearly meant — or give one next step after a failed receipt.",
      "A prose-only reply is allowed only after a failed tool receipt: one plain failure line, then one next step.",
    ].join(" ")
  }
  return [
    "This User message is an edit ask on a Paper document they named.",
    "Find that document with paper_listDocs and paper_getDoc, then call paper_updateContent in this turn.",
    "Do not write the rewrite as prose first. Never ask whether to apply. Never tell the User to paste.",
    "A prose-only reply is allowed only after a failed tool receipt: one plain failure line, then one next step.",
  ].join(" ")
}

/**
 * Force a Command on edit asks so Free models cannot draft-then-ask.
 * After a successful or failed paper_updateContent call, the model may speak.
 */
export function mustEditToolChoice(input: {
  userText: string
  hasFocusDoc: boolean
  calledTools: readonly string[]
}): MustEditToolChoice | undefined {
  if (!isPaperEditAsk(input.userText, input.hasFocusDoc)) return undefined
  if (input.calledTools.includes(MUST_EDIT_TOOLS.updateContent))
    return undefined
  if (input.hasFocusDoc) {
    return { type: "tool", toolName: MUST_EDIT_TOOLS.updateContent }
  }
  if (
    !input.calledTools.includes(MUST_EDIT_TOOLS.listDocs) &&
    !input.calledTools.includes(MUST_EDIT_TOOLS.getDoc)
  ) {
    return { type: "tool", toolName: MUST_EDIT_TOOLS.listDocs }
  }
  if (!input.calledTools.includes(MUST_EDIT_TOOLS.getDoc)) {
    return { type: "tool", toolName: MUST_EDIT_TOOLS.getDoc }
  }
  return { type: "tool", toolName: MUST_EDIT_TOOLS.updateContent }
}

/**
 * Hide every other tool while a Command is forced. Free models ignore
 * toolChoice and otherwise stop after paper_getDoc (QVE-189).
 */
export function mustEditPrepareStep(input: {
  userText: string
  hasFocusDoc: boolean
  calledTools: readonly string[]
}): MustEditPrepareStep {
  const toolChoice = mustEditToolChoice(input)
  if (!toolChoice) return {}
  return { toolChoice, activeTools: [toolChoice.toolName] }
}

export function mustEditStillNeedsUpdate(input: {
  userText: string
  hasFocusDoc: boolean
  calledTools: readonly string[]
}): boolean {
  if (!isPaperEditAsk(input.userText, input.hasFocusDoc)) return false
  return !input.calledTools.includes(MUST_EDIT_TOOLS.updateContent)
}

export function toolNamesFromSteps(
  steps: readonly { toolCalls?: readonly { toolName?: string }[] }[]
): string[] {
  return steps.flatMap((step) =>
    (step.toolCalls ?? [])
      .map((call) => call.toolName)
      .filter((name): name is string => typeof name === "string")
  )
}
