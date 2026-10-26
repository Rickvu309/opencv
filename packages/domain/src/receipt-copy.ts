/** User-facing fail copy when a Command dies on bad input. */
export const INVALID_COMMAND_INPUT_COPY = "The input wasn't valid"

/** User-facing fail copy when the dumped error is about a card id / UUID. */
export const INVALID_CARD_ID_COPY = "That card id isn't valid"

/** Coach invented or omitted an Apply card id. Do not mutate. */
export const APPLY_CARD_ID_MISSING_COPY =
  "I need a listed Apply card id before I can change the board."

const MACHINE_FAIL = [
  /invalid input for tool/i,
  /type validation failed/i,
  /invalid_format|invalid_string|invalid_type|invalid_union|unrecognized_keys|too_small|too_big|invalid_enum/i,
  /invalid uuid/i,
  /expected \w+, received/i,
  /\[\s*\{/,
  /\{[^{}]*"(?:code|path|validation|format|pattern)"/,
  /\/\^/,
  /\\d\{/,
  /\\[sSdDwW]/,
]

const CARD_ID_HINT = /uuid|cardid|card id/i

/**
 * Keep Command fail receipts as one human sentence.
 * Zod dumps, regex patterns, and JSON blobs never reach the User.
 */
export function humanizeCommandFailCopy(message: string): string {
  const text = message.replace(/\s+/g, " ").trim()
  if (!text || isMachineFailCopy(text)) {
    return CARD_ID_HINT.test(message)
      ? INVALID_CARD_ID_COPY
      : INVALID_COMMAND_INPUT_COPY
  }
  return text
}

export function isMachineFailCopy(message: string): boolean {
  const text = message.trim()
  if (!text) return true
  if (text.length > 160) return true
  return MACHINE_FAIL.some((pattern) => pattern.test(text))
}
