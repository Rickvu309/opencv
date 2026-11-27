export const STATUS = Object.freeze({
  pass: "pass",
  fail: "fail",
  expectedFail: "expected-fail",
  nowPasses: "now-passes",
})

const firstLine = (error) => String(error?.message ?? error).split("\n")[0]

export function verdict(row, problem, pinned) {
  if (problem && pinned) return STATUS.expectedFail
  if (problem) return STATUS.fail
  return pinned ? STATUS.nowPasses : STATUS.pass
}

export async function judgeRow(row, person, pinned, now) {
  const started = now()
  let problem
  try {
    await person.begin(row)
    problem = row.pass(await row.act(person))
  } catch (error) {
    problem = `the step threw: ${firstLine(error)}`
  } finally {
    await person.end(row)
  }
  return {
    id: row.id,
    area: row.area,
    does: row.does,
    status: verdict(row, problem, pinned),
    ...(problem ? { problem } : {}),
    ...(pinned ? { pinned } : {}),
    ms: now() - started,
  }
}

export async function walkRows({
  rows,
  person,
  expected,
  now,
  say = () => {},
}) {
  const results = []
  for (const row of rows) {
    const result = await judgeRow(row, person, expected[row.id], now)
    say(rowLine(result))
    results.push(result)
  }
  return results
}

export function rowLine(result) {
  const pin = result.pinned ? ` (${result.pinned})` : ""
  if (result.status === STATUS.pass) return `pass ${result.id}`
  if (result.status === STATUS.nowPasses)
    return `now-passes ${result.id}${pin}: remove it from scripts/ui/walk/expected-failures.json`
  return `${result.status} ${result.id}${pin}: ${result.problem}`
}

export function unknownPins(rows, expected) {
  const ids = new Set(rows.map((row) => row.id))
  return Object.keys(expected).filter((id) => !ids.has(id))
}

export function walkSummary(results) {
  const count = (status) =>
    results.filter((result) => result.status === status).length
  const failed = count(STATUS.fail) + count(STATUS.nowPasses)
  return {
    rows: results.length,
    passed: count(STATUS.pass),
    expectedFailures: count(STATUS.expectedFail),
    failed,
    ok: failed === 0,
  }
}

export function resultTable(results) {
  return [
    "| Row | Area | Status | What happened |",
    "| --- | --- | --- | --- |",
    ...results.map(
      (result) =>
        `| ${result.id} | ${result.area} | ${result.status} | ${(result.problem ?? result.does).replaceAll("|", "/")} |`
    ),
  ]
}
