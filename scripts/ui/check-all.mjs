import { isSameBox } from "./design-map.mjs"

export function screensToCheck(map, screens) {
  const mapped = new Set(map.map((row) => row.screen))
  const listed = screens.filter((screen) => mapped.has(screen.id))
  return {
    reachable: listed.filter((screen) => !screen.unreachable),
    unreachable: listed.filter((screen) => screen.unreachable),
  }
}

export function measureTargets(rows) {
  return rows.flatMap((row) => [
    { name: row.label, selector: row.selector },
    ...(row.from ? [{ name: `${row.label} from`, selector: row.from }] : []),
  ])
}

export function rowsWithTargets(rows, measured) {
  let at = 0
  return rows.map((row) => {
    const own = measured[at++]?.items ?? []
    const from = row.from ? (measured[at++]?.items?.[0] ?? null) : undefined
    return { row, items: own, from }
  })
}

export function screenResult(screen, table, failedRows) {
  return {
    screen,
    compared: table.length,
    failed: failedRows.length,
    failures: failedRows.map((row) => ({
      element: row.label,
      property: row.property,
      design: row.design,
      rendered: row.rendered,
      difference: row.difference,
      status: row.status,
    })),
  }
}

export function summarize(results, seconds) {
  const failedScreens = results.filter(
    (result) => result.error || result.failed > 0
  )
  return {
    screens: results.length,
    compared: results.reduce((sum, result) => sum + (result.compared ?? 0), 0),
    failed: results.reduce((sum, result) => sum + (result.failed ?? 0), 0),
    failedScreens: failedScreens.map((result) => result.screen),
    seconds,
    ok: failedScreens.length === 0,
  }
}

export function summaryLine(result) {
  if (result.error) return `${result.screen}: error ${result.error}`
  const verdict = result.failed === 0 ? "pass" : "FAIL"
  const known =
    result.newFailed === undefined
      ? ""
      : `, ${result.knownFailed} already failing on main`
  return `${result.screen}: ${verdict}, ${result.compared} compared, ${result.failed} failed${known}`
}

export function totalLine(total) {
  return `total: ${total.ok ? "pass" : "FAIL"}, ${total.screens} screens, ${total.compared} compared, ${total.failed} failed, ${total.seconds}s`
}

export const sameBoxAgainst = (rows) => [
  ...new Set(rows.filter(isSameBox).map((row) => row.against)),
]
