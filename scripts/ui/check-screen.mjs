import { UsageError } from "./args.mjs"
import { measure, openScreen } from "./capture.mjs"
import {
  measureTargets,
  rowsWithTargets,
  sameBoxAgainst,
  screenResult,
} from "./check-all.mjs"
import {
  checkNotes,
  compareBoxes,
  compareRow,
  failed,
  relate,
  renderTable,
  specimenRow,
} from "./compare.mjs"
import {
  DESIGN_MAP,
  SPECIMEN_WARNING,
  isSameBox,
  rowsForScreen,
} from "./design-map.mjs"
import { knownFailureLines, markKnownFailures } from "./known-drift.mjs"
import { decidedDesign, ownerDecisionLines } from "./owner-decision.mjs"
import { composedPlacement, frameGeometry } from "./pen.mjs"
import { SCREENS } from "./screens.mjs"

const json = (value) => JSON.stringify(value)

export async function checkScreen({
  browser,
  state,
  index,
  screen,
  rows,
  tolerance,
  onMain,
  shot,
}) {
  const measureOn = async (target, list, picture) => {
    const { page, close } = await openScreen(browser, state, target, {
      width: 1440,
    })
    const measured = await measure(page, measureTargets(list))
    if (picture) await page.screenshot({ path: picture })
    await close()
    return rowsWithTargets(list, measured).map(({ items, from }) =>
      relate(items, from)
    )
  }
  const rendered = await measureOn(screen, rows, shot)
  const baseline = new Map()
  for (const id of sameBoxAgainst(rows)) {
    const target = SCREENS.find((candidate) => candidate.id === id)
    if (!target || target.unreachable)
      throw new UsageError(`${id} is unreachable: ${target?.unreachable}`)
    const list = rows.filter((row) => row.against === id)
    const boxes = await measureOn(target, list)
    list.forEach((row, at) => baseline.set(row, boxes[at]))
  }
  return {
    ...screenReport({
      screen,
      rows,
      rendered,
      baseline,
      index,
      tolerance,
      onMain,
    }),
    rendered,
  }
}

export function screenReport({
  screen,
  rows,
  rendered,
  baseline,
  index,
  tolerance,
  onMain,
}) {
  const placements = new Map(
    rows
      .filter((row) => !isSameBox(row))
      .map((row) => [row, composedPlacement(index, row)])
  )
  const table = rows.flatMap((row, at) => {
    if (isSameBox(row))
      return compareBoxes({
        label: `${row.label} vs ${row.against}`,
        before: baseline.get(row),
        after: rendered[at],
        props: row.props,
        tolerance,
      })
    const placement = placements.get(row)
    return [
      ...(placement.inScreen ? [] : [specimenRow(row)]),
      ...compareRow({
        label: row.label,
        design: decidedDesign(row, frameGeometry(index, row.frame)),
        rendered: rendered[at],
        props: row.props,
        tolerance,
      }),
    ]
  })
  const bad = failed(table)
  const result = markKnownFailures(
    screenResult(screen.id, table, bad),
    onMain,
    tolerance
  )
  const ownerLines = rows
    .filter((row) => !isSameBox(row))
    .flatMap((row) => ownerDecisionLines(row, frameGeometry(index, row.frame)))
  return {
    result,
    ownerLines,
    lines: [
      `${screen.id} at 1440x900, tolerance ${tolerance}px`,
      ...renderTable(table),
      ...ownerLines,
      ...checkNotes({
        rows,
        failedLabels: new Set(bad.map((row) => row.label)),
        placements,
        warning: SPECIMEN_WARNING,
      }),
      ...knownFailureLines(result),
      json({
        screen: screen.id,
        compared: table.length,
        failed: bad.length,
        ...(result.newFailed === undefined
          ? {}
          : {
              newFailed: result.newFailed,
              knownFailed: result.knownFailed,
              changedFailed: result.changedFailed,
            }),
      }),
    ],
  }
}

export function baseChecker(index) {
  if (!index) return null
  return async (browser, state, screen) => {
    const rows = rowsForScreen(DESIGN_MAP, screen.id)
    if (rows.length === 0) return null
    const outcome = await checkScreen({
      browser,
      state,
      index,
      screen,
      rows,
      tolerance: 1,
    })
    return outcome.result
  }
}
