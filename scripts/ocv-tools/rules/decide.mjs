// decide(job, facts) runs that job's rows in table order. A missing fact kind
// throws: a job must not pass a rule by forgetting to gather it.
import { Refused } from "../result.mjs"
import { RULES } from "./table.mjs"

function causeOf(row, facts) {
  return typeof row.cause === "function" ? row.cause(facts) : row.cause
}

function runRow(row, facts, job) {
  for (const kind of row.needs) {
    if (!(kind in facts))
      throw new Error(`${job} did not gather ${kind} for ${row.id}`)
  }
  if (!row.check) return null
  const message = row.check(facts)
  if (!message) return null
  return {
    id: row.id,
    message,
    fix: row.fix(facts),
    exit: row.exit ?? "REFUSED",
    cause: causeOf(row, facts),
  }
}

export function decide(job, facts) {
  const refusals = []
  for (const row of RULES) {
    if (!row.jobs.includes(job) || !row.check) continue
    const hit = runRow(row, facts, job)
    if (!hit) continue
    refusals.push(hit)
    if (row.stop) break
  }
  return { ok: refusals.length === 0, refusals }
}

export function needsOf(job) {
  const kinds = []
  for (const row of RULES) {
    if (!row.jobs.includes(job) || !row.check) continue
    for (const kind of row.needs) if (!kinds.includes(kind)) kinds.push(kind)
  }
  return kinds
}

// One row, for a re-read or an effect-time check. A full decide() there can
// fire a different code than the one this moment is about.
export function evaluate(id, facts) {
  const row = RULES.find((item) => item.id === id)
  if (!row) throw new Error(`no rule ${id}`)
  return runRow(row, facts, "evaluate")
}

export function refusalError(refusal) {
  const error = new Refused(refusal.id, refusal.message, refusal.fix)
  if (refusal.cause) error.cause = refusal.cause
  return error
}
