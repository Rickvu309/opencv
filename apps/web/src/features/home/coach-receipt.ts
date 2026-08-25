import type { ThreadToolPart } from "@workspace/domain"

export function commandNameFromTool(name: string) {
  return name.includes(".") ? name : name.replace("_", ".")
}

export function receiptHeadline(part: ThreadToolPart) {
  return `Ran ${commandNameFromTool(part.name)} — ${part.summary}`
}
