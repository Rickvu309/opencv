const GUARD_PATH = /^\s*["'`]scripts\/[^"'`]+\.test\.mjs["'`],?\s*$/
const LEDGER_ID = /^\s*id:\s*["'][^"']+["'],\s*$/
const LEDGER_FILE = /^\s*file:\s*["'][^"']+\.test\.[cm]?[jt]sx?["'],\s*$/
const CI_ONLY = /\bCI_ONLY_GUARDS\b/
const MIN_GUARD_RUN = 3
const MIN_LEDGER_ROWS = 2
const LOOKBACK = 3

export const REGISTRY_FIX =
  "Do not keep a list every new guard must join. Add scripts/guard-ledger/<id>.json for a ledger row; a root scripts/*.test.mjs is run by the GitHub guards job without being listed."

export function detectHandLists(text) {
  const lines = text.split("\n")
  const hits = []
  let run = []
  const closeRun = () => {
    const head = lines.slice(Math.max(0, run[0] - LOOKBACK), run[0]).join("\n")
    if (run.length >= MIN_GUARD_RUN && !CI_ONLY.test(head))
      hits.push({
        line: run[0] + 1,
        kind: "a list of guard test paths",
        count: run.length,
      })
    run = []
  }
  lines.forEach((line, at) => {
    if (GUARD_PATH.test(line)) run.push(at)
    else if (run.length > 0) closeRun()
  })
  if (run.length > 0) closeRun()
  const rows = lines.flatMap((line, at) =>
    LEDGER_ID.test(line) && LEDGER_FILE.test(lines[at + 1] ?? "") ? [at] : []
  )
  if (rows.length >= MIN_LEDGER_ROWS)
    hits.push({
      line: rows[0] + 1,
      kind: "ledger rows written inline",
      count: rows.length,
    })
  return hits
}
