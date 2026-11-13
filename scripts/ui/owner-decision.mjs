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

export const GROK_COACH_PAGE_COMPOSER = {
  decided: "2026-11-13",
  reason: `${GROK_CLEAN_COACH}: the docked page composer keeps the council's one-line height of about 80 and rounds to 24 like the Grok, ChatGPT and Claude composers, instead of the 114px, radius 18 pen frame`,
  expect: {
    height: 82,
    radius: 24,
  },
}

export const GROK_COACH_PAGE_COLUMN = {
  decided: "2026-11-13",
  reason: `${GROK_CLEAN_COACH}: turns sit 28 apart like Grok's roomier column, instead of the pen frame's 20`,
  expect: {
    gap: 28,
  },
}

export const GROK_COACH_PANEL_COMPOSER = {
  decided: "2026-11-13",
  reason: `${GROK_CLEAN_COACH}: the panel composer rounds to 20, the page composer's shape at panel size, instead of the pen frame's 14`,
  expect: {
    radius: 20,
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
