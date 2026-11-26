import { chatToolNameSchema, type ChatToolName } from "@workspace/domain/coach"
import { catalog } from "@workspace/domain/kernel"

type ToolCopy = { label: string; read?: string }

function declaredCopy(name: ChatToolName): ToolCopy {
  const operation = (
    catalog as Record<string, { label?: string; readLabel?: string }>
  )[name]
  if (!operation?.label) throw new Error(`${name} has no Coach label`)
  return operation.readLabel
    ? { label: operation.label, read: operation.readLabel }
    : { label: operation.label }
}

const toolCopy = Object.fromEntries(
  chatToolNameSchema.options.map((name) => [name, declaredCopy(name)])
) as Record<ChatToolName, ToolCopy>

export const COACH_TOOL_LABELS = Object.fromEntries(
  chatToolNameSchema.options.map((name) => [name, toolCopy[name].label])
) as Record<ChatToolName, string>

export function coachToolLabel(name: string) {
  const parsed = chatToolNameSchema.safeParse(name)
  return parsed.success ? toolCopy[parsed.data].label : "Coach action"
}

export function coachReadLabel(name: string) {
  const parsed = chatToolNameSchema.safeParse(name)
  return parsed.success ? toolCopy[parsed.data].read : undefined
}

export function humanToolText(text: string) {
  return text.replace(/\b[a-z]+\.[a-zA-Z.]+\b/g, (name) => {
    const parsed = chatToolNameSchema.safeParse(name)
    return parsed.success ? toolCopy[parsed.data].label : name
  })
}
