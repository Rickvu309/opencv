const SHOWN = 6

const RETIRE_FIX =
  'scripts/ocv-tools.mjs retire "<subject>" --because "<why the old check is wrong now>" --replaced-by <test file>'

function listed(items) {
  const shown = items.slice(0, SHOWN).join("; ")
  return items.length > SHOWN
    ? `${shown}; and ${items.length - SHOWN} more`
    : shown
}

function protectedWeakened(facts) {
  const weakened = facts.protected?.weakened ?? []
  if (!weakened.length) return null
  return `the change weakens ${weakened.length} protected check(s) it may not weaken without a retirement: ${listed(weakened.map((item) => `${item.what} ${item.subject}`))}`
}

export function retirementProblems(protectedFacts) {
  const facts = protectedFacts ?? {}
  const changed = new Map(
    (facts.changed ?? []).map((item) => [item.path, item.headBlob])
  )
  const used = [...(facts.retired ?? [])]
  const problems = []
  for (const r of facts.retirements ?? []) {
    const name = r.subject ? `"${r.subject}"` : r.file
    if (r.broken) {
      problems.push(`${r.file} is not a JSON list of retirements`)
      continue
    }
    if (!r.subject || !r.because || !r.replacedBy) {
      problems.push(`${name} needs a subject, a because and a replacedBy`)
      continue
    }
    const blob = changed.get(r.replacedBy)
    if (!blob) {
      problems.push(
        `${name} names ${r.replacedBy}, which this change does not add or edit`
      )
      continue
    }
    if (
      !r.proof ||
      r.proof.replacedByBlob !== blob ||
      r.proof.failedOnBase !== true ||
      r.proof.passedOnHead !== true
    ) {
      problems.push(
        `${name} has no flip proof for the current ${r.replacedBy} (it must fail on the fork point and pass on the head)`
      )
      continue
    }
    if (!used.some((item) => item.retiredBy === r.subject))
      problems.push(`${name} retires nothing this change weakens`)
  }
  return problems
}

function retireUnproven(facts) {
  if (facts.retireRun) return facts.retireRun.problem ?? null
  const problems = retirementProblems(facts.protected)
  if (!problems.length) return null
  return `a retirement is not proved: ${listed(problems)}`
}

export const protectedRows = [
  {
    kind: "rule",
    id: "PROTECTED_WEAKENED",
    section: "5",
    says: "A change may not remove or weaken a test case, an assertion, a fixture, a corpus file, a ledger row, a ratchet or known-failures list, a limit bound or a checker setting that is on main, unless a retirement in scripts/retired names it; moved and renamed cases with the same assertions, added cases and tighter bounds are free.",
    at: ["push", "finish", "pr"],
    needs: ["protected"],
    check: protectedWeakened,
    fix: () =>
      `Restore what the change weakened (git checkout origin/main -- <file>), or, when the old check is wrong on purpose: ${RETIRE_FIX}`,
  },
  {
    kind: "rule",
    id: "RETIRE_UNPROVEN",
    section: "5",
    says: "Each retirement names a replacement test this change adds or edits, carries a flip proof for that test's current text (fails on the fork point, passes on the head), and retires something the change weakens.",
    at: ["push", "finish", "pr", "retire"],
    needs: ["protected"],
    check: retireUnproven,
    fix: (facts) =>
      facts.retireRun?.fix ??
      `Run the retire verb again to prove it: ${RETIRE_FIX}`,
  },
]
