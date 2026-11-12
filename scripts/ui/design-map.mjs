const PADDING = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]

export const APP_SHELL = "OC App shell"
const SHELL_CHAT_PANEL = "G8L8J"

export const SPECIMEN_WARNING =
  "confirm this frame is the composed screen, not a kit specimen, before changing the app"

export const DESIGN_MAP = [
  {
    screen: "paper-panel-open",
    label: "Coach panel",
    selector: '[data-slot="coach-panel"]',
    composedScreen: APP_SHELL,
    frame: SHELL_CHAT_PANEL,
    props: ["width", "height", "radius", "x", "y"],
  },
  {
    screen: "paper-panel-open",
    label: "Coach panel header",
    selector: '[data-slot="coach-panel-header"]',
    composedScreen: APP_SHELL,
    via: SHELL_CHAT_PANEL,
    frame: "mIJmP",
    props: ["height", ...PADDING, "gap"],
  },
  {
    screen: "paper-panel-open",
    label: "Coach panel body",
    selector:
      '[data-slot="coach-panel"] [data-slot="message-scroller-content"]',
    composedScreen: APP_SHELL,
    via: SHELL_CHAT_PANEL,
    frame: "Gz2an",
    props: [...PADDING, "gap"],
  },
  {
    screen: "paper-panel-open",
    label: "Coach composer wrap",
    selector:
      '[data-slot="coach-panel"] [data-slot="coach-workspace-composer"]',
    composedScreen: APP_SHELL,
    via: SHELL_CHAT_PANEL,
    frame: "Sh1cr",
    props: PADDING,
  },
  {
    screen: "paper-panel-open",
    label: "Coach composer",
    selector: '[data-slot="coach-panel"] [data-slot="coach-composer"]',
    composedScreen: APP_SHELL,
    via: SHELL_CHAT_PANEL,
    frame: "FAcND",
    props: ["radius", ...PADDING, "gap"],
  },
  {
    screen: "paper-panel-open",
    label: "Dock bar",
    selector: '[data-slot="app-dock"]',
    composedScreen: APP_SHELL,
    frame: "IYQY3",
    props: ["height", "gap"],
  },
  {
    screen: "coach-chat-finished",
    label: "Dock chat chip",
    selector: '[data-slot="dock-recent"] button',
    composedScreen: APP_SHELL,
    frame: "Fp9se",
    props: ["height", "radius", "paddingLeft", "paddingRight"],
  },
  {
    screen: "paper-panel-open",
    label: "Dock Coach button",
    selector: "[data-dock-coach]",
    composedScreen: APP_SHELL,
    frame: "gsnSu",
    props: ["height", "radius", ...PADDING, "gap"],
  },
  {
    screen: "paper-panel-open",
    label: "Dock History button",
    selector: '[data-slot="app-dock"] button[aria-label="History"]',
    composedScreen: APP_SHELL,
    frame: "dlhEn",
    props: ["width", "height", "radius"],
  },
  {
    screen: "paper-panel-open",
    kind: "same-box",
    against: "paper-panel-closed",
    label: "Main content beside the Coach card",
    selector: '[data-slot="shell-main"] main',
    props: ["x", "width"],
  },
  {
    screen: "paper-panel-open",
    kind: "same-box",
    against: "paper-panel-closed",
    label: "Writing page beside the Coach card",
    selector: 'main [contenteditable="true"]',
    props: ["x", "width"],
  },
]

export function rowsForScreen(map, screenId) {
  return map.filter((row) => row.screen === screenId)
}

export const isSameBox = (row) => row.kind === "same-box"

export function validateDesignMap(map, properties, screenIds) {
  const known = new Set(properties)
  return map.flatMap((row, at) => {
    const label = row.label ?? `row ${at + 1}`
    const problems = []
    const required = isSameBox(row)
      ? ["screen", "label", "selector", "against"]
      : ["screen", "label", "selector", "frame", "composedScreen"]
    for (const field of required)
      if (typeof row[field] !== "string" || row[field] === "")
        problems.push(`${label}: ${field} is required`)
    if (row.kind !== undefined && !isSameBox(row))
      problems.push(`${label}: unknown kind ${row.kind}`)
    if (isSameBox(row) && row.against === row.screen)
      problems.push(`${label}: against must be another screen`)
    if (screenIds)
      for (const field of ["screen", "against"])
        if (row[field] !== undefined && !screenIds.has(row[field]))
          problems.push(`${label}: unknown screen ${row[field]}`)
    if (!Array.isArray(row.props) || row.props.length === 0)
      problems.push(`${label}: props is required`)
    for (const prop of row.props ?? [])
      if (!known.has(prop)) problems.push(`${label}: unknown property ${prop}`)
    return problems
  })
}
