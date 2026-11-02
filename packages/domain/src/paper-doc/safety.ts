import type { PaperDocument } from "./document.js"
import type { EditEffect } from "./edits.js"
import { isSubsequence } from "./text-align.js"
import { fieldsOf, indexOf } from "./tree.js"

function plainOf(fields: { text: Record<string, string> } | null, key: string) {
  return fields?.text[key] ?? ""
}

export function personWorkLost(
  base: PaperDocument,
  live: PaperDocument,
  merged: PaperDocument
): string[] {
  const before = indexOf(base)
  const now = indexOf(live)
  const after = indexOf(merged)
  const problems: string[] = []
  for (const [id, l] of now) {
    const b = before.get(id)
    const m = after.get(id)
    if (!b && !m) {
      problems.push(`A block you added (${id}) would be lost`)
      continue
    }
    const liveFields = fieldsOf(l.node, false)
    const baseFields = b ? fieldsOf(b.node, false) : null
    const mergedFields = m ? fieldsOf(m.node, false) : null
    for (const key of Object.keys(liveFields.text)) {
      const typed = plainOf(liveFields, key) !== plainOf(baseFields, key)
      if (typed && !mergedFields) {
        problems.push(`Text typed in block ${id} would be lost`)
      }
    }
    for (const [key, value] of Object.entries(liveFields.props)) {
      if (baseFields && baseFields.props[key] === value) continue
      if (!mergedFields || mergedFields.props[key] !== value) {
        problems.push(`A change to ${key} in block ${id} would be lost`)
      }
    }
    if (b && m && l.owner !== b.owner && m.owner !== l.owner) {
      problems.push(`The block ${id} you moved would be put back`)
    }
  }
  return [...new Set(problems)]
}

function characterCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const char of text) counts.set(char, (counts.get(char) ?? 0) + 1)
  return counts
}

function addsCharacters(allowed: string, result: string): boolean {
  const room = characterCounts(allowed)
  for (const char of result) {
    const left = room.get(char) ?? 0
    if (left === 0) return true
    room.set(char, left - 1)
  }
  return false
}

export function undoProblems(
  pre: PaperDocument,
  post: PaperDocument,
  live: PaperDocument,
  merged: PaperDocument,
  expected: {
    reverted: PaperDocument | null
    stripped: PaperDocument | null
  }
): string[] {
  const before = indexOf(pre)
  const edited = indexOf(post)
  const now = indexOf(live)
  const after = indexOf(merged)
  const reverted = expected.reverted ? indexOf(expected.reverted) : null
  const stripped = expected.stripped ? indexOf(expected.stripped) : null
  const problems: string[] = []
  for (const [id, l] of now) {
    const p = before.get(id)
    const q = edited.get(id)
    const m = after.get(id)
    const created = q !== undefined && p === undefined
    if (!m) {
      if (!created) problems.push(`Block ${id} would be removed by the undo`)
      continue
    }
    const liveFields = fieldsOf(l.node, false)
    const mergedFields = fieldsOf(m.node, false)
    const preFields = p ? fieldsOf(p.node, false) : null
    const postFields = q ? fieldsOf(q.node, false) : null
    for (const key of Object.keys(liveFields.text)) {
      const result = plainOf(mergedFields, key)
      const wasLive = plainOf(liveFields, key)
      if (addsCharacters(`${wasLive}${plainOf(preFields, key)}`, result)) {
        problems.push(`The undo would add text to block ${id}`)
      }
      const touchedByEdit =
        postFields !== null &&
        plainOf(preFields, key) !== plainOf(postFields, key)
      let wanted = wasLive
      if (created) {
        wanted = plainOf(
          stripped?.get(id) ? fieldsOf(stripped.get(id)!.node, false) : null,
          key
        )
      } else if (touchedByEdit) {
        wanted =
          wasLive === plainOf(postFields, key)
            ? plainOf(preFields, key)
            : plainOf(
                reverted?.get(id)
                  ? fieldsOf(reverted.get(id)!.node, false)
                  : null,
                key
              )
      }
      if (result !== wanted) {
        problems.push(
          `You changed block ${id} since the Coach's edit, so Undo would damage your text`
        )
      }
    }
    for (const [key, value] of Object.entries(mergedFields.props)) {
      if (liveFields.props[key] === value) continue
      if (!postFields || postFields.props[key] !== liveFields.props[key]) {
        problems.push(
          `You changed ${key} in block ${id} since the Coach's edit`
        )
      }
    }
  }
  return [...new Set(problems)]
}

export function effectsMissing(
  effects: readonly EditEffect[],
  merged: PaperDocument
): { op: number; reason: string }[] {
  const after = indexOf(merged)
  const missing: { op: number; reason: string }[] = []
  for (const effect of effects) {
    const found = after.get(effect.id)
    if (effect.kind === "removed") {
      if (found) {
        missing.push({
          op: effect.op,
          reason: `Block ${effect.id} is still there`,
        })
      }
      continue
    }
    if (!found) {
      missing.push({
        op: effect.op,
        reason: `Block ${effect.id} is no longer in the document`,
      })
      continue
    }
    if (
      (effect.kind === "created" || effect.kind === "moved") &&
      found.owner !== effect.owner
    ) {
      missing.push({
        op: effect.op,
        reason: `Block ${effect.id} did not end up where you put it`,
      })
    }
    if (effect.kind === "text") {
      const text = fieldsOf(found.node, false).text
      const now = text.title ?? text.content ?? ""
      if (!isSubsequence(effect.inserted, now)) {
        missing.push({
          op: effect.op,
          reason: `Your text is not in block ${effect.id}`,
        })
      }
    }
    if (effect.kind === "fields") {
      const props = fieldsOf(found.node, false).props
      const wrong = Object.entries(effect.fields).find(
        ([key, value]) => props[key] !== value
      )
      if (wrong) {
        missing.push({
          op: effect.op,
          reason: `${wrong[0]} of block ${effect.id} was not set`,
        })
      }
    }
  }
  return missing
}
