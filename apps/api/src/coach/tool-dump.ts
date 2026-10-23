const TOOL_NAME_DUMP = /paper[_\s.]*updatecontent/i

/**
 * Raw tool-call / tool-result text Free models sometimes stream instead of
 * a receipt. Never show this in the Thread.
 */
export function isToolDumpText(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim()
  if (!trimmed) return false
  if (TOOL_NAME_DUMP.test(trimmed)) return true
  if (/"docId"/.test(trimmed) && /contentVersion/i.test(trimmed)) return true
  if (/invalid input for tool/i.test(trimmed)) return true
  if (/<(?:tool_call|function_call|invoke)\b/i.test(trimmed)) return true
  if (
    trimmed.includes("{") &&
    /"content"\s*:/.test(trimmed) &&
    /"summary"\s*:/.test(trimmed)
  ) {
    return true
  }
  if (/"ok"\s*:/.test(trimmed) && /"(?:error|data)"\s*:/.test(trimmed)) {
    return true
  }
  return false
}

/** Drop tool-call JSON / paper_updateContent dumps; keep human prose. */
export function stripToolDumpText(text: string): string {
  if (!text) return ""
  let next = text.replace(/```[\s\S]*?```/g, " ")
  next = next.replace(/paper[_\s.]*updatecontent/gi, " ")
  next = next.replace(
    /<(?:tool_call|function_call|invoke)\b[\s\S]*?(?:<\/(?:tool_call|function_call|invoke)>|\/>)/gi,
    " "
  )
  next = next.replace(/invalid input for tool[\s\S]{0,400}/gi, " ")
  next = removeJsonObjects(next, looksLikeToolJson)
  return next.replace(/\s+/g, " ").trim()
}

function looksLikeToolJson(json: string): boolean {
  return (
    /"docId"/.test(json) ||
    /contentVersion/i.test(json) ||
    (/"content"\s*:/.test(json) && /"experience"/.test(json)) ||
    /"toolName"|"tool_name"|"arguments"/.test(json) ||
    (/"ok"\s*:/.test(json) && /"(?:error|data)"\s*:/.test(json))
  )
}

function removeJsonObjects(
  text: string,
  predicate: (json: string) => boolean
): string {
  let result = ""
  let index = 0
  while (index < text.length) {
    if (text[index] !== "{") {
      result += text[index]
      index += 1
      continue
    }
    const end = findMatchingBrace(text, index)
    if (end < 0) {
      result += text.slice(index)
      break
    }
    const object = text.slice(index, end + 1)
    if (!predicate(object)) result += object
    index = end + 1
  }
  return result
}

function findMatchingBrace(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escape = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escape) escape = false
      else if (char === "\\") escape = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === "{") depth += 1
    else if (char === "}") {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}
