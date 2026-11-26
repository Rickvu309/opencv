import { ERROR_CODES } from "@workspace/domain/kernel"

import { CommandError } from "../platform/errors.js"

export const AGENT_RATE_LIMIT_MESSAGE =
  "Agent tool call rate limit reached. Try again in 60 seconds."

const NEXT = {
  reconnect: "Stop and ask the person to reconnect this agent in OpenCV.",
  forbidden: "Use only the tools this connection lists, or ask the person.",
  limited: "Wait, then try again. Do not repeat the call in a loop.",
  reread:
    "Read the document or Job again, then prepare a new proposal against what you read.",
  too_large: "Send a smaller change, or split it into fewer operations.",
  unsupported:
    "Leave that line unchanged and propose changes to other lines, or ask the person.",
  unavailable: "Ask the person to open the document in OpenCV.",
  invalid_input: "Check this tool's input schema and send the call again.",
  not_found: "List or read again to get current ids for this person.",
  failed: "Try again later, or ask the person.",
} as const

type AgentErrorCode = keyof typeof NEXT

const AUTHORED: Record<AgentErrorCode, readonly string[]> = {
  reconnect: [
    "This connection cannot read documents. Stop and ask the person to reconnect.",
    "This connection cannot propose document edits. Stop and ask the person to reconnect.",
  ],
  forbidden: [
    "This connection cannot use this command",
    "This connection cannot use this read",
  ],
  limited: [
    AGENT_RATE_LIMIT_MESSAGE,
    "This connection has 20 pending proposals. Approve or deny existing proposals in OpenCV before proposing more.",
  ],
  reread: [
    "This page link is invalid. Read the document again.",
    "This page belongs to another document or version.",
    "This Word document has changed. Read it again before editing.",
    "This Word document has changed. Read it again before saving.",
    "This Word edit does not name a saved revision.",
    "This Word version belongs to another document.",
    "This saved Word edit is no longer available. No document was changed.",
    "This line no longer matches the page. Read it again. No document was changed.",
    "This page changed. Read it again before saving. No document was changed.",
    "This text span is no longer available in this document revision. Read it again before editing.",
    "This Word projection is no longer available. No document was changed.",
  ],
  too_large: [
    "This text is larger than the supported Word region.",
    "This Word edit is too large. Send fewer changes.",
    "This Word review is too large. Send fewer changes.",
    "This edit is too large to save. No document was changed.",
    "This edit request is too large. Send a smaller batch of supported replacements.",
    "This edit contains too much text. Send a smaller batch of supported replacements.",
  ],
  unsupported: [
    "This edit is not a Word batch. No document was changed.",
    "This edit changes the same paragraph twice.",
    "This edit uses a paragraph it already removed.",
    "This empty line has no place for words. Paper will not change it.",
    "This line ends a page section. Paper will not change it.",
    "This line sits in a table or a box. Paper will not change it.",
    "This line sits in a table. Paper can change its words but will not split, join or remove it.",
    "This line mixes formatting, such as bold or a different font. Paper will not rewrite words across that formatting. No document was changed.",
    "This paragraph has a break or a hidden character. Paper will not change it.",
    "This paragraph has a change mark. Paper will not change it.",
    "This paragraph holds hidden Word markup. Paper will not change it.",
    "This paragraph is numbered. Paper can change its words but will not split, join or remove it.",
    "This paragraph has a link, a break or a proofing mark. Paper can change the words around them but will not split, join or remove it.",
    "This paragraph has a link, a field, a tab or another Word feature. Paper will not change it.",
    "This replacement contains text controls Paper cannot safely insert. Use plain text without tabs or line breaks.",
  ],
  unavailable: [
    "Saved Word documents are unavailable.",
    "This Word document is not available.",
    "This Word document or version is not available.",
    "This Word revision is not available.",
  ],
  invalid_input: [],
  not_found: [],
  failed: [],
}

const FALLBACK: Record<AgentErrorCode, string> = {
  reconnect:
    "This connection is no longer active. Stop and ask the person to reconnect.",
  forbidden: "This connection cannot do that.",
  limited: "Too many calls or proposals right now.",
  reread: "This changed after you read it.",
  too_large: "This change is too large.",
  unsupported: "Paper cannot make that change safely.",
  unavailable: "This is not available right now.",
  invalid_input: "The input does not match this tool's schema.",
  not_found: "Nothing with that id is available to this connection.",
  failed: "The tool failed.",
}

const authoredCode = new Map<string, AgentErrorCode>(
  Object.entries(AUTHORED).flatMap(([code, messages]) =>
    messages.map((message) => [message, code as AgentErrorCode] as const)
  )
)

function codeOf(error: unknown): AgentErrorCode {
  if (error instanceof CommandError) {
    if (error.message === "This agent connection is no longer active")
      return "reconnect"
    if (error.code === ERROR_CODES.VALIDATION_ERROR) return "invalid_input"
    if (error.code === ERROR_CODES.NOT_FOUND) return "not_found"
    if (error.code === ERROR_CODES.CONFLICT) return "reread"
    if (
      error.code === ERROR_CODES.FORBIDDEN ||
      error.code === ERROR_CODES.UNKNOWN_COMMAND
    )
      return "forbidden"
    return "failed"
  }
  if (error instanceof Error && error.name === "ZodError")
    return "invalid_input"
  return "failed"
}

export function agentToolError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  const authored = authoredCode.get(message)
  const code = authored ?? codeOf(error)
  return {
    code,
    error: authored ? message : FALLBACK[code],
    next: NEXT[code],
  }
}
