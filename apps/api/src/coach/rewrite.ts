import {
  decodePaperContent,
  isCvDocument,
  isLetterDocument,
  isProofDocument,
  type CoachFocusDoc,
  type CoachMode,
} from "@workspace/domain"

import { namedOtherCvSection, namesExperienceOrBullet } from "./focus-doc.js"
import { isPaperEditAsk } from "./must-edit-intent.js"
import { sanitizeMustEditLine } from "./replacement-text.js"

const REWRITE_STOP =
  /^(?:rewrite|rewrote|rewriting|shorten|shortened|shortening|tailor|tailored|tailoring|sharpen|sharpened|sharpening|edit|edited|editing|fix|fixing|make|update|apply|the|this|that|my|a|an|for|to|of|on|in|and|or|be|it|please|can|you|bullet|bullets|section|document|doc|open|named|one|sentence|experience|summary|opening|proof|letter|resume|cover|internship|education|skill|skills|project|projects|headline|contact|language|languages)$/i

type LocatedRewrite =
  | { kind: "cv-summary"; original: string }
  | {
      kind: "cv-bullet"
      roleIndex: number
      bulletIndex: number
      original: string
    }
  | { kind: "letter"; original: string }
  | { kind: "proof-step"; index: number; original: string }

export function findFocusRewriteOriginal(
  doc: CoachFocusDoc,
  userText: string,
  selectionText?: string
): string | null {
  return locateRewrite(doc, userText, selectionText)?.original ?? null
}

export function applyRewriteToFocusContent(
  doc: CoachFocusDoc,
  userText: string,
  replacement: string,
  selectionText?: string
): unknown | null {
  const located = locateRewrite(doc, userText, selectionText)
  if (!located) return null
  const next = sanitizeMustEditLine(replacement)
  if (!next || next === located.original) return null

  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok) return null
  const content = structuredClone(decoded.data)

  if (located.kind === "cv-summary" && isCvDocument(content)) {
    content.summary = next
    return content
  }
  if (located.kind === "cv-bullet" && isCvDocument(content)) {
    const bullets = content.experience[located.roleIndex]?.bullets
    if (!bullets || bullets[located.bulletIndex] === undefined) return null
    bullets[located.bulletIndex] = next
    return content
  }
  if (located.kind === "letter" && isLetterDocument(content)) {
    content.markdown = next
    return content
  }
  if (located.kind === "proof-step" && isProofDocument(content)) {
    const step = content.steps[located.index]
    if (!step) return null
    step.body = next
    return content
  }
  return null
}

/**
 * Generic last-resort rewrite only. Scout / preview-smoke phrases are not
 * a production strategy — return null so the guarantee can emit a failed receipt.
 */
export function localRewriteText(
  original: string,
  userText: string
): string | null {
  const trimmed = original.replace(/\s+/g, " ").trim()
  if (!trimmed) return null
  if (/shorten|shorter|one sentence/i.test(userText)) {
    const first = trimmed.split(/(?<=\.)\s+/)[0] ?? trimmed
    if (first.length > 0 && first !== trimmed) return first
    if (trimmed.length > 140) return `${trimmed.slice(0, 139).trimEnd()}.`
  }
  return null
}

/**
 * Free Paper must-edit after QVE-196: do not send tools / tool_choice to
 * `openrouter/free`. That request shape filters the Free Models Router onto
 * the tool-calling pool, which 429s under café/Scout load and dies as a
 * quota wall before paper_updateContent (QVE-197).
 */
export function shouldUseFreeTextMustEdit(input: {
  mode?: CoachMode
  userText: string
  hasFocusDoc: boolean
}): boolean {
  return (
    input.mode === "free" &&
    input.hasFocusDoc &&
    isPaperEditAsk(input.userText, true)
  )
}

function locateRewrite(
  doc: CoachFocusDoc,
  userText: string,
  selectionText?: string
): LocatedRewrite | null {
  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok) return null
  const content = decoded.data
  const selected = selectionText?.replace(/\s+/g, " ").trim()

  if (isCvDocument(content)) {
    if (selected) {
      if (
        content.summary.includes(selected) ||
        selected.includes(content.summary)
      ) {
        return { kind: "cv-summary", original: content.summary }
      }
      for (const [roleIndex, role] of content.experience.entries()) {
        for (const [bulletIndex, bullet] of role.bullets.entries()) {
          if (bullet.includes(selected) || selected.includes(bullet)) {
            return {
              kind: "cv-bullet",
              roleIndex,
              bulletIndex,
              original: bullet,
            }
          }
        }
      }
    }

    const wantsSummary = /\bsummary\b/i.test(userText)
    const wantsExperience = namesExperienceOrBullet(userText)
    const tokens = significantTokens(userText)

    if (wantsExperience) {
      return bestExperienceBullet(content, tokens)
    }
    if (wantsSummary) {
      return { kind: "cv-summary", original: content.summary }
    }
    if (namedOtherCvSection(userText)) {
      return null
    }
    const hit = bestExperienceBullet(content, tokens)
    if (hit) return hit
    return content.summary
      ? { kind: "cv-summary", original: content.summary }
      : null
  }

  if (isLetterDocument(content)) {
    return { kind: "letter", original: content.markdown }
  }
  if (isProofDocument(content) && content.steps[0]) {
    return {
      kind: "proof-step",
      index: 0,
      original: content.steps[0].body,
    }
  }
  return null
}

function bestExperienceBullet(
  content: {
    experience: { role: string; company: string; bullets: string[] }[]
  },
  tokens: string[]
): Extract<LocatedRewrite, { kind: "cv-bullet" }> | null {
  let best:
    | (Extract<LocatedRewrite, { kind: "cv-bullet" }> & { score: number })
    | null = null
  for (const [roleIndex, role] of content.experience.entries()) {
    const roleHay = `${role.role} ${role.company}`
    for (const [bulletIndex, bullet] of role.bullets.entries()) {
      const score = scoreHaystack(`${roleHay} ${bullet}`, tokens)
      if (score <= 0) continue
      if (!best || score > best.score) {
        best = {
          kind: "cv-bullet",
          roleIndex,
          bulletIndex,
          original: bullet,
          score,
        }
      }
    }
  }
  return best
}

function significantTokens(text: string): string[] {
  return [...text.toLowerCase().matchAll(/[a-z][a-z0-9'+-]{2,}/g)]
    .map((match) => match[0])
    .filter((word) => !REWRITE_STOP.test(word))
}

function scoreHaystack(haystack: string, tokens: string[]): number {
  const lower = haystack.toLowerCase()
  return tokens.reduce((count, token) => {
    if (!lower.includes(token)) return count
    return count + (token.length >= 8 ? 4 : 1)
  }, 0)
}
