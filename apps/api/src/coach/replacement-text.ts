export function isRealRewrite(
  original: string,
  replacement: string | null | undefined
): replacement is string {
  if (typeof replacement !== "string") return false
  const next = replacement.replace(/\s+/g, " ").trim()
  const prev = original.replace(/\s+/g, " ").trim()
  return next.length > 0 && next !== prev
}

/** One-line rewrite prompt — no tools, no full CV JSON, no next-step speech. */
export function freeMustEditLinePrompt(input: {
  original: string
  userText: string
  docName: string
}): string {
  return [
    "You are rewriting one line on a Paper document for an early-career User.",
    "Reply with only the rewritten line. No quotes, no preamble, no thinking, no chain of thought, no next step, no markdown.",
    "Never tell the User to paste. Never ask whether to apply.",
    "Do not invent scout or canned CV copy. Change only the line they asked about.",
    `Document: ${input.docName}`,
    `Ask: ${input.userText}`,
    `Current line:\n${input.original}`,
  ].join("\n")
}

const PASTE_OR_ASK =
  /\bpaste\b|\bapply\??$|\bshould i apply\b|\bwant me to apply\b/i

const THINKING_BLOCK =
  /<(?:think|thinking|thought|reasoning)\b[^>]*>[\s\S]*?<\/(?:think|thinking|thought|reasoning)>/gi

const THINKING_LINE =
  /^(?:[-*•]\s+|\d+[.)]\s+)?(?:#{1,6}\s*)?(?:\*{0,2}|_{0,2})(?:a\s+)?(?:thinking(?:\s+process)?|reasoning|chain of thought|internal monologue)(?:\*{0,2}|_{0,2})?\s*:?\s*$/i

const META_LINE =
  /^(?:[-*•]\s+|\d+[.)]\s+)?(?:let me think|okay[,.]?|alright[,.]?|the user (?:wants|asked|is asking)|i (?:need|will|should|'ll|am going) to|here(?:'s| is) my (?:thinking|reasoning|analysis))\b/i

const THINKING_PREFIX =
  /^(?:[-*•]\s+|\d+[.)]\s+)?(?:a\s+)?thinking(?:\s+process)?\s*:\s*/i

/**
 * Drop model thinking / chain-of-thought / meta lines so they cannot land
 * on Paper via paper.updateContent (QVE-198).
 */
export function stripMustEditThinking(text: string): string {
  const next = text.replace(/\r\n/g, "\n").replace(THINKING_BLOCK, "\n")
  const kept: string[] = []
  for (const line of next.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) {
      kept.push("")
      continue
    }
    if (THINKING_LINE.test(trimmed) || META_LINE.test(trimmed)) continue
    const withoutPrefix = trimmed.replace(THINKING_PREFIX, "").trim()
    if (
      !withoutPrefix ||
      THINKING_LINE.test(withoutPrefix) ||
      META_LINE.test(withoutPrefix)
    ) {
      continue
    }
    kept.push(withoutPrefix)
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * One clean rewrite line, or null if the text is thinking / meta / a dump.
 */
export function sanitizeMustEditLine(text: string): string | null {
  const stripped = stripMustEditThinking(text)
  if (!stripped) return null
  const next = polishReplacementLine(stripped)
  if (!next || PASTE_OR_ASK.test(next)) return null
  if (next.length > 400) return null
  if (looksLikeThinkingResidue(next)) return null
  if (looksLikePaperDump(next)) return null
  return next
}

/**
 * Turn a Free-model one-line reply into a Command replacement.
 * Empty, unchanged, thinking/meta, paste/ask-to-apply, or a document dump
 * fail closed. Prefer the last remaining line so leaked chain-of-thought
 * before the rewrite is dropped (QVE-198).
 */
export function extractMustEditReplacement(
  modelText: string,
  original: string
): string | null {
  const stripped = stripMustEditThinking(modelText)
  if (!stripped) return null
  if (
    looksLikePaperDump(stripped) ||
    looksLikePaperDump(polishReplacementLine(stripped))
  ) {
    return null
  }

  for (const candidate of replacementCandidates(stripped)) {
    const cleaned = sanitizeMustEditLine(candidate)
    if (cleaned && isRealRewrite(original, cleaned)) return cleaned
  }
  return null
}

function replacementCandidates(text: string): string[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
  const pool = blocks.length > 0 ? blocks : [text.trim()]
  const last = pool[pool.length - 1] ?? ""
  const lastLines = last
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const ordered = [
    lastLines[lastLines.length - 1],
    last,
    ...pool.slice().reverse(),
    text,
  ].filter((item): item is string => Boolean(item?.trim()))
  return [...new Set(ordered)]
}

function polishReplacementLine(text: string): string {
  let next = text.replace(/\s+/g, " ").trim()
  next = next.replace(/^["'`]+|["'`]+$/g, "").trim()
  next = next.replace(/^\*\*(.+)\*\*$/s, "$1").trim()
  next = next
    .replace(
      /^(?:here(?:'s| is)(?: the)?(?: rewritten)?(?: line| bullet)?[:\s]*)/i,
      ""
    )
    .trim()
  next = next.replace(/^[-*•]\s+/, "").trim()
  return next
}

function looksLikeThinkingResidue(text: string): boolean {
  const lower = text.toLowerCase()
  if (/^(?:a\s+)?thinking(?:\s+process)?\b/.test(lower)) return true
  if (/\bchain of thought\b/.test(lower)) return true
  if (/\b(?:let me think|here is my thinking)\b/.test(lower)) return true
  return false
}

function looksLikePaperDump(text: string): boolean {
  if (
    /"experience"\s*:/.test(text) &&
    /"(?:summary|education|skills)"\s*:/.test(text)
  ) {
    return true
  }
  if (/"docId"/.test(text) && /contentVersion/i.test(text)) return true
  if ((text.match(/(?:^|\s)[-•]\s/g) ?? []).length >= 2) return true
  if (/Experience\[\d+\]/.test(text)) return true
  return false
}
