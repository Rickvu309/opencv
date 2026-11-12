export const PROPERTIES = [
  "width",
  "height",
  "x",
  "y",
  "radius",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "fontSize",
  "pitch",
  "left",
  "below",
  "centerOffset",
]

export const RELATIVE = ["left", "below", "centerOffset"]

const round = (value) => Math.round(value * 100) / 100

export const withinTolerance = (got, want, tolerance) =>
  Math.abs(round(got - want)) <= tolerance

export function sameMeasure(got, want, tolerance) {
  if (typeof got === "number" && typeof want === "number")
    return withinTolerance(got, want, tolerance)
  return got === want
}

export function relate(items, from) {
  const [first, second] = items
  if (!first) return null
  const related = { ...first }
  if (second) related.pitch = round(second.x - first.x)
  if (from) {
    related.left = round(first.x - from.x)
    related.below = round(first.y - (from.y + from.height))
    related.centerOffset = round(
      first.x + first.width / 2 - (from.x + from.width / 2)
    )
  }
  return related
}

export function compareRow({ label, design, rendered, props, tolerance }) {
  return props.map((property) => {
    const want = design?.[property]
    const got = rendered?.[property]
    if (typeof want !== "number")
      return {
        label,
        property,
        design: want ?? null,
        rendered: got ?? null,
        difference: null,
        status: "no-design-number",
      }
    if (rendered === null || rendered === undefined)
      return {
        label,
        property,
        design: want,
        rendered: null,
        difference: null,
        status: "missing",
      }
    const difference = round(got - want)
    return {
      label,
      property,
      design: want,
      rendered: round(got),
      difference,
      status: withinTolerance(got, want, tolerance) ? "ok" : "mismatch",
    }
  })
}

export function compareBoxes({ label, before, after, props, tolerance }) {
  if (before && after)
    return compareRow({
      label,
      design: before,
      rendered: after,
      props,
      tolerance,
    })
  return props.map((property) => ({
    label,
    property,
    design: before?.[property] ?? null,
    rendered: after?.[property] ?? null,
    difference: null,
    status: "missing",
  }))
}

const FAILING = new Set(["mismatch", "missing", "not-in-composed-screen"])

export function failed(rows) {
  return rows.filter((row) => FAILING.has(row.status))
}

export function specimenRow({ label, frame, composedScreen }) {
  return {
    label,
    property: "frame",
    design: composedScreen,
    rendered: frame,
    difference: null,
    status: "not-in-composed-screen",
  }
}

export function checkNotes({ rows, failedLabels, placements, warning }) {
  return rows
    .filter((row) => row.frame && failedLabels.has(row.label))
    .map(
      (row) =>
        `${row.label}: frame ${row.frame}, pen path ${placements.get(row)?.path ?? "not found in the pen file"}; ${warning}`
    )
}

export function renderTable(rows) {
  const header = [
    "element",
    "property",
    "design",
    "rendered",
    "difference",
    "status",
  ]
  const body = rows.map((row) => [
    row.label,
    row.property,
    String(row.design ?? "-"),
    String(row.rendered ?? "-"),
    row.difference === null ? "-" : String(row.difference),
    row.status,
  ])
  const widths = header.map((_, column) =>
    Math.max(...[header, ...body].map((cells) => cells[column].length))
  )
  return [header, ...body].map((cells) =>
    cells
      .map((cell, column) => cell.padEnd(widths[column]))
      .join("  ")
      .trimEnd()
  )
}
