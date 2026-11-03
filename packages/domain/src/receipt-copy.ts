const INVALID_COMMAND_INPUT_COPY = "The input wasn't valid"

const INVALID_CARD_ID_COPY = "That card id isn't valid"

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

export function humanizeCommandFailCopy(message: string): string {
  const text = message.replace(/\s+/g, " ").trim()
  if (!text || isMachineFailCopy(text)) {
    return CARD_ID_HINT.test(message)
      ? INVALID_CARD_ID_COPY
      : INVALID_COMMAND_INPUT_COPY
  }
  return text
}

function isMachineFailCopy(message: string): boolean {
  const text = message.trim()
  if (!text) return true
  if (text.length > 160) return true
  return MACHINE_FAIL.some((pattern) => pattern.test(text))
}
