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
import { SPECIMEN_WARNING, isSameBox } from "./design-map.mjs"
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
}) {
  const measureOn = async (target, list) => {
    const { page, close } = await openScreen(browser, state, target, {
      width: 1440,
    })
    const measured = await measure(page, measureTargets(list))
    await close()
    return rowsWithTargets(list, measured).map(({ items, from }) =>
      relate(items, from)
    )
  }
  const rendered = await measureOn(screen, rows)
  const baseline = new Map()
  for (const id of sameBoxAgainst(rows)) {
    const target = SCREENS.find((candidate) => candidate.id === id)
    if (!target || target.unreachable)
      throw new UsageError(`${id} is unreachable: ${target?.unreachable}`)
    const list = rows.filter((row) => row.against === id)
    const boxes = await measureOn(target, list)
    list.forEach((row, at) => baseline.set(row, boxes[at]))
  }
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
        design: frameGeometry(index, row.frame),
        rendered: rendered[at],
        props: row.props,
        tolerance,
      }),
    ]
  })
  const bad = failed(table)
  const result = screenResult(screen.id, table, bad)
  return {
    result,
    lines: [
      `${screen.id} at 1440x900, tolerance ${tolerance}px`,
      ...renderTable(table),
      ...checkNotes({
        rows,
        failedLabels: new Set(bad.map((row) => row.label)),
        placements,
        warning: SPECIMEN_WARNING,
      }),
      json({ screen: screen.id, compared: table.length, failed: bad.length }),
    ],
  }
}
