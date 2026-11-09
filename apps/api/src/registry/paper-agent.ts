import { ERROR_CODES } from "@workspace/domain"

import { CommandError } from "./errors.js"

const readDescription =
  "Read authorized Paper text and supported edit targets at one pinned revision. Follow nextCursor until null; keep the same document and revision. Locked content is context only. Reading does not grant permission to edit."
const editDescription =
  "Propose exact text replacements in supported regions from paper_read. Each before must be a nonempty exact substring occurring once in that target, including overlapping matches. Returns a pending proposalId and person approval link. The document is unchanged until the person approves. Never report Applied or Saved from this response."

export function paperAgentRefusal(name: string) {
  if (name !== "paper.read" && name !== "paper.edit") return null
  if (process.env.PAPER_AGENT_TOOLS !== "true")
    return "Paper tools are not available to agents yet. Use the OpenCV app."
  if (name === "paper.read")
    return "This connection cannot read documents. Stop and ask the person to reconnect."
  return "This connection cannot propose document edits. Stop and ask the person to reconnect."
}

export function paperEditBasisRefused(name: string, input: unknown) {
  if (name !== "paper.edit" || !input || typeof input !== "object") return false
  return typeof (input as { basedOn?: unknown }).basedOn !== "string"
}

export const paperEditBasisMessage =
  "This edit does not use a saved Word revision. Read the document again and propose one exact text replacement."

export function paperToolDescription(name: string) {
  if (name === "paper.read") return readDescription
  if (name === "paper.edit") return editDescription
  return null
}

export function paperToolAnnotations(name: string) {
  if (name === "paper.read") return { idempotentHint: true as const }
  return {}
}

export function publicPaperProposal(value: unknown, url: string | undefined) {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const proposalId = record.pendingActionId
  if (record.pending !== true || typeof proposalId !== "string" || !url)
    return null
  return {
    pending: true as const,
    proposalId,
    status: "pending approval" as const,
    url,
  }
}

const rereadMessages = new Set([
  "This page link is invalid. Read the document again.",
  "This page belongs to another document or version.",
  "This Word document has changed. Read it again before editing.",
  "This Word document has changed. Read it again before saving.",
  "This Word edit does not name a saved revision.",
  "This Word version belongs to another document.",
  "This saved Word edit is no longer available. No document was changed.",
  paperEditBasisMessage,
])

function unsupportedPaperError(name: string) {
  if (name === "paper.read")
    return {
      error: "This page is not supported. Read the document again.",
      code: "unsupported",
      next: "Read the document again from the start. Keep the same document and revision.",
    }
  return {
    error:
      "This edit is not supported. Read the document again and send one exact text replacement.",
    code: "unsupported",
    next: "Read the document again and send one supported edit, or ask the person.",
  }
}

export function paperAgentError(error: unknown, name = "paper.edit") {
  const message = error instanceof Error ? error.message : ""
  if (message.startsWith("Paper tools are not available"))
    return {
      error: message,
      code: "unavailable",
      next: "Use the OpenCV app.",
    }
  if (message === "Saved Word documents are unavailable.")
    return {
      error: message,
      code: "unavailable",
      next: "Ask the person to open the document in OpenCV.",
    }
  if (message.includes("Stop and ask the person to reconnect"))
    return {
      error: message,
      code: "reconnect",
      next: "Stop and ask the person to reconnect.",
    }
  if (message === "This agent connection is no longer active")
    return {
      error:
        "This connection is no longer active. Stop and ask the person to reconnect.",
      code: "reconnect",
      next: "Stop and ask the person to reconnect.",
    }
  if (message.includes("Try again in 60 seconds"))
    return {
      error: message,
      code: "limited",
      next: "Try again in 60 seconds.",
    }
  if (message === "This text is larger than the supported Word region.")
    return {
      error: message,
      code: "too_large",
      next: "Choose a smaller supported edit, or ask the person.",
    }
  if (rereadMessages.has(message))
    return {
      error: message,
      code: "reread",
      next: "Read the document again, then prepare a new proposal.",
    }
  if (
    message.includes("Read the document again") ||
    message.includes("Read it again") ||
    message.includes("another document or version") ||
    message.includes("saved revision")
  )
    return {
      error: "Read the document again, then prepare a new proposal.",
      code: "reread",
      next: "Read the document again, then prepare a new proposal.",
    }
  if (
    (error instanceof CommandError &&
      error.code === ERROR_CODES.VALIDATION_ERROR) ||
    (error instanceof Error && error.name === "ZodError")
  )
    return unsupportedPaperError(name)
  return {
    error:
      "No proposal was confirmed. Read the document again before another proposal.",
    code: "refused",
    next: "Do not retry this call unchanged.",
  }
}
