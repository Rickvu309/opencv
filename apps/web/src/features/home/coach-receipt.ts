import {
  humanizeCommandFailCopy,
  type ThreadToolPart,
} from "@workspace/domain"

export function commandNameFromTool(name: string) {
  return name.includes(".") ? name : name.replace("_", ".")
}

export function receiptHeadline(part: ThreadToolPart) {
  const summary = part.ok
    ? part.summary
    : humanizeCommandFailCopy(part.summary)
  return `Ran ${commandNameFromTool(part.name)} — ${summary}`
}

export function receiptReversalNote(part: ThreadToolPart) {
  if (!part.reversal) return null
  if (part.reversal.possible) {
    return `Reversible — ${part.reversal.description}`
  }
  return part.reversal.description
}

export function receiptShowsUndo(part: ThreadToolPart) {
  return (
    part.ok &&
    part.reversal?.possible === true &&
    part.undone !== true &&
    Boolean(part.toolCallId)
  )
}
