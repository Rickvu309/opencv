import type { PaperDocument } from "./document.js"
import type { EditEffect } from "./edits.js"
import {
  countOf,
  insertedRuns,
  isSubsequence,
  matchIndexes,
} from "./text-align.js"
import { fieldsOf, indexOf } from "./tree.js"

const TOO_LONG = "A block is too long to check, so nothing was changed"

function insertedText(before: string, after: string): string | null {
  if (before === after) return ""
  const runs = insertedRuns(before, after)
  return runs ? runs.join("") : null
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
    for (const [key, value] of Object.entries(liveFields.text)) {
      const typed = insertedText(baseFields?.text[key] ?? "", value)
      if (typed === null) {
        problems.push(TOO_LONG)
      } else if (typed && !mergedFields) {
        problems.push(`Text typed in block ${id} would be lost`)
      } else if (
        typed &&
        mergedFields &&
        !isSubsequence(typed, mergedFields.text[key] ?? "")
      ) {
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

function charBudget(runs: readonly string[]): Map<string, number> {
  const budget = new Map<string, number>()
  for (const char of runs.join("")) {
    budget.set(char, (budget.get(char) ?? 0) + 1)
  }
  return budget
}

function deletedChars(before: string, after: string): string[] | null {
  const matches = matchIndexes(before, after)
  if (!matches) return null
  return [...before].filter((_char, index) => matches[index] === -1)
}

export function undoProblems(
  pre: PaperDocument,
  post: PaperDocument,
  live: PaperDocument,
  merged: PaperDocument
): string[] {
  const before = indexOf(pre)
  const edited = indexOf(post)
  const now = indexOf(live)
  const after = indexOf(merged)
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
    for (const [key, value] of Object.entries(liveFields.text)) {
      const kept = mergedFields.text[key] ?? ""
      const coachRuns =
        postFields && postFields.text[key] !== undefined
          ? insertedRuns(preFields?.text[key] ?? "", postFields.text[key]!)
          : []
      const lost = deletedChars(value, kept)
      if (!coachRuns || !lost) {
        problems.push(TOO_LONG)
        continue
      }
      const budget = charBudget(coachRuns)
      for (const char of lost) {
        const left = budget.get(char) ?? 0
        if (left === 0) {
          problems.push(
            `You changed block ${id} since the Coach's edit, so Undo would remove your text`
          )
          break
        }
        budget.set(char, left - 1)
      }
      for (const run of coachRuns) {
        const stillThere = countOf(value, run)
        if (stillThere > 0 && countOf(kept, run) >= stillThere) {
          problems.push(
            `You changed block ${id} since the Coach's edit, so Undo cannot take its words out`
          )
        }
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
