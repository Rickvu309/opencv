const PADDING = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]

export const DESIGN_MAP = [
  {
    screen: "paper-panel-open",
    label: "Coach panel",
    selector: '[data-slot="coach-panel"]',
    frame: "G8L8J",
    props: ["width", "height", "radius", "x", "y"],
  },
  {
    screen: "paper-panel-open",
    label: "Coach panel header",
    selector: '[data-slot="coach-panel-header"]',
    frame: "mIJmP",
    props: ["height", ...PADDING, "gap"],
  },
  {
    screen: "paper-panel-open",
    label: "Coach panel body",
    selector:
      '[data-slot="coach-panel"] [data-slot="message-scroller-content"]',
    frame: "Gz2an",
    props: [...PADDING, "gap"],
  },
  {
    screen: "paper-panel-open",
    label: "Coach composer wrap",
    selector:
      '[data-slot="coach-panel"] [data-slot="coach-workspace-composer"]',
    frame: "Sh1cr",
    props: PADDING,
  },
  {
    screen: "paper-panel-open",
    label: "Coach composer",
    selector: '[data-slot="coach-panel"] [data-slot="coach-composer"]',
    frame: "FAcND",
    props: ["radius", ...PADDING, "gap"],
  },
  {
    screen: "paper-panel-open",
    label: "Dock bar",
    selector: '[data-slot="app-dock"]',
    frame: "IYQY3",
    props: ["height", "gap"],
  },
  {
    screen: "coach-chat-finished",
    label: "Dock chat chip",
    selector: '[data-slot="dock-recent"] button',
    frame: "NBIYs",
    props: ["height", "radius", "paddingLeft", "paddingRight"],
  },
  {
    screen: "paper-panel-open",
    label: "Dock Coach button",
    selector: "[data-dock-coach]",
    frame: "OqrwQ",
    props: ["height", "radius", ...PADDING, "gap"],
  },
  {
    screen: "paper-panel-open",
    label: "Dock History button",
    selector: '[data-slot="app-dock"] button[aria-label="History"]',
    frame: "Xt6MC",
    props: ["width", "height", "radius"],
  },
]

export function rowsForScreen(map, screenId) {
  return map.filter((row) => row.screen === screenId)
}

export function validateDesignMap(map, properties) {
  const known = new Set(properties)
  return map.flatMap((row, at) => {
    const label = row.label ?? `row ${at + 1}`
    const problems = []
    for (const field of ["screen", "label", "selector", "frame"])
      if (typeof row[field] !== "string" || row[field] === "")
        problems.push(`${label}: ${field} is required`)
    if (!Array.isArray(row.props) || row.props.length === 0)
      problems.push(`${label}: props is required`)
    for (const prop of row.props ?? [])
      if (!known.has(prop)) problems.push(`${label}: unknown property ${prop}`)
    return problems
  })
}
