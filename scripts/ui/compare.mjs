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
]

const round = (value) => Math.round(value * 100) / 100

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
      status: Math.abs(difference) <= tolerance ? "ok" : "mismatch",
    }
  })
}

export function failed(rows) {
  return rows.filter(
    (row) => row.status === "mismatch" || row.status === "missing"
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
