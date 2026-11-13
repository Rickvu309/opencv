export const DEFAULT_BUDGET = {
  load: 30,
  sameGet: 3,
  idle: 1,
  idleMs: 3_000,
  pollers: [],
}

export const REQUEST_BUDGETS = {}

export function budgetFor(screenId, budgets = REQUEST_BUDGETS) {
  return { ...DEFAULT_BUDGET, ...(budgets[screenId] ?? {}) }
}

const pathOf = (url) => url.split("?")[0]

function tally(records) {
  const counts = new Map()
  for (const record of records) {
    const key = `${record.method} ${record.url}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].sort((left, right) => right[1] - left[1])
}

const top = (records) =>
  tally(records)
    .slice(0, 3)
    .map(([key, count]) => `${key} x${count}`)
    .join(", ")

export function requestProblems(log, budget) {
  const problems = []
  const load = log.filter((record) => record.phase === "load")
  const idle = log.filter(
    (record) =>
      record.phase === "idle" &&
      !budget.pollers.some((poller) => pathOf(record.url) === poller)
  )
  if (load.length > budget.load)
    problems.push(
      `requests did not settle: ${load.length} requests while the screen opened, over the budget of ${budget.load} (most: ${top(load)})`
    )
  for (const [key, count] of tally(
    load.filter((record) => record.method === "GET")
  ))
    if (count > budget.sameGet)
      problems.push(
        `requests did not settle: ${key} ran ${count} times while the screen opened, over ${budget.sameGet}`
      )
  if (idle.length > budget.idle)
    problems.push(
      `requests did not settle: ${idle.length} requests in the ${budget.idleMs / 1000} s after the screen settled, over ${budget.idle} (most: ${top(idle)})`
    )
  return problems
}

export function requestRecorder({ apiOrigin, now }) {
  const log = []
  let phase = "load"
  const started = now()
  return {
    log,
    setPhase: (next) => {
      phase = next
    },
    onRequest: (request) => {
      if (phase === "done") return
      const url = new URL(request.url())
      if (url.origin !== apiOrigin) return
      if (request.method() === "OPTIONS") return
      log.push({
        method: request.method(),
        url: `${url.pathname}${url.search}`,
        at: now() - started,
        phase,
      })
    },
  }
}
