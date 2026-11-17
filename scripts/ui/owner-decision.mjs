const DAY = /^\d{4}-\d{2}-\d{2}$/

export const WORD_SIZED_WRITING_PAGE = {
  decided: "2026-11-12",
  reason:
    "the owner sized the Paper writing page like a real Word page, an 8.5in sheet with 1in margins, instead of the 560px pen frame",
  expect: {
    width: 816,
    paddingTop: 96,
    paddingRight: 96,
    paddingBottom: 96,
    paddingLeft: 96,
  },
}

const GROK_CLEAN_COACH =
  "the owner asked for the Coach chat to look as clean as Grok, learning from ChatGPT and Claude, instead of the Linear-based council pass; see the chat references index of 2026-11-13"

export const LINEAR_COACH_PAGE_COMPOSER = {
  decided: "2026-11-17",
  reason:
    "the owner asked for the Coach to look like Linear's agent page: the page composer is Linear's two-row card at the pen frame's 114 high and radius 18, kept as wide as the 760 reading column instead of the pen frame's 720",
  expect: {
    width: 760,
  },
}

export const GROK_COACH_PAGE_COLUMN = {
  decided: "2026-11-13",
  reason: `${GROK_CLEAN_COACH}: the reading column is 760 with 16px text and turns 32 apart, Grok's measure, instead of the pen frame's 720 and 20`,
  expect: {
    width: 760,
    gap: 32,
  },
}

export function ownerDecisionProblems(row, label) {
  const decision = row.ownerDecision
  if (decision === undefined) return []
  if (decision === null || typeof decision !== "object")
    return [`${label}: ownerDecision must be an object`]
  const problems = []
  if (typeof decision.reason !== "string" || decision.reason.trim() === "")
    problems.push(`${label}: ownerDecision needs a reason`)
  if (typeof decision.decided !== "string" || !DAY.test(decision.decided))
    problems.push(`${label}: ownerDecision needs a decided date as YYYY-MM-DD`)
  const expect = decision.expect ?? {}
  if (Object.keys(expect).length === 0)
    problems.push(`${label}: ownerDecision needs at least one expected value`)
  for (const [prop, value] of Object.entries(expect)) {
    if (!(row.props ?? []).includes(prop))
      problems.push(
        `${label}: ownerDecision sets ${prop}, which the row does not check`
      )
    if (typeof value !== "number")
      problems.push(`${label}: ownerDecision ${prop} must be a number`)
  }
  return problems
}

export function decidedDesign(row, pen) {
  const expect = row.ownerDecision?.expect
  return expect ? { ...pen, ...expect } : pen
}

export function ownerDecisionLines(row, pen) {
  const decision = row.ownerDecision
  if (!decision) return []
  return Object.entries(decision.expect).map(
    ([prop, value]) =>
      `${row.label} ${prop}: expects ${value} by owner decision of ${decision.decided}, not the pen frame ${row.frame} (${pen?.[prop] ?? "-"}); ${decision.reason}`
  )
}
