import { RELATIVE } from "./compare.mjs"
import {
  WORD_SIZED_WRITING_PAGE,
  ownerDecisionProblems,
} from "./owner-decision.mjs"

const PADDING = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]

export const APP_SHELL = "OC App shell"
const SHELL_CHAT_PANEL = "G8L8J"
const SHELL_SIDEBAR = "jsloS"
const SIDEBAR_NAV_INBOX = "n4ZOA1"
const COACH_WORKING = "W3.5 Coach working"
const COACH_CAP_REACHED = "W3.6 Free cap reached"
const PAPER_LIBRARY = "W5.2 Paper library"
const DELETE_CONFIRM = "W5.5 Delete confirm"
const CV_EDITING = "W6.4 Editing"
const APPLY_BOARD = "W9.3 Board"
const PREFERENCES = "W12.1 Preferences"
const SIGN_IN = "W1.1 Continue"
const MAIN_PANEL = '[data-slot="shell-main"] main'
const PAPER_SECTION = 'main section[aria-label="Paper"]'
const APPROVAL_CARD = '[aria-label="Review Coach action"]'
const COACH_COLUMN = '[data-slot="chat"] [data-slot="message-scroller-content"]'

export const SPECIMEN_WARNING =
  "confirm this frame is the composed screen, not a kit specimen, before changing the app"

function writingPageRows(screen) {
  return [
    {
      screen,
      label: "Writing page",
      selector: 'main [contenteditable="true"]',
      composedScreen: CV_EDITING,
      frame: "LFKqV",
      props: ["width", "radius", ...PADDING],
      ownerDecision: WORD_SIZED_WRITING_PAGE,
    },
    {
      screen,
      label: "Writing page centered in the main area",
      selector: 'main [contenteditable="true"]',
      from: MAIN_PANEL,
      composedScreen: CV_EDITING,
      frame: "SoAVC",
      props: ["centerOffset"],
    },
  ]
}

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
  {
    screen: "paper-home",
    label: "Sidebar",
    selector: '[data-slot="shell-nav"]',
    composedScreen: APP_SHELL,
    frame: SHELL_SIDEBAR,
    props: ["width", ...PADDING, "gap"],
  },
  {
    screen: "paper-home",
    label: "Sidebar nav item",
    selector: '[data-slot="shell-nav"] [data-slot="nav-item"]',
    composedScreen: APP_SHELL,
    via: SHELL_SIDEBAR,
    frame: SIDEBAR_NAV_INBOX,
    props: ["width", "height", "radius", "paddingLeft", "paddingRight", "gap"],
  },
  {
    screen: "paper-home",
    label: "Sidebar nav label type",
    selector: '[data-slot="shell-nav"] [data-slot="nav-item"]',
    composedScreen: APP_SHELL,
    via: [SHELL_SIDEBAR, SIDEBAR_NAV_INBOX],
    frame: "ygZNM",
    props: ["fontSize"],
  },
  {
    screen: "paper-home",
    label: "Sidebar section label",
    selector: '[data-slot="sidebar-group-label"]',
    composedScreen: APP_SHELL,
    via: SHELL_SIDEBAR,
    frame: "y9F7p3",
    props: ["height", "paddingLeft", "gap"],
  },
  {
    screen: "paper-home",
    label: "Sidebar section label type",
    selector: '[data-slot="sidebar-group-label"]',
    composedScreen: APP_SHELL,
    via: SHELL_SIDEBAR,
    frame: "HQOy0",
    props: ["fontSize"],
  },
  {
    screen: "paper-home",
    label: "Paper page header",
    selector: `${PAPER_SECTION} > div:nth-of-type(1)`,
    composedScreen: PAPER_LIBRARY,
    frame: "nV0FO",
    props: ["height", "paddingLeft", "paddingRight", "gap"],
  },
  {
    screen: "paper-home",
    label: "Paper title type",
    selector: `${PAPER_SECTION} h1`,
    composedScreen: PAPER_LIBRARY,
    frame: "Imv3q",
    props: ["fontSize"],
  },
  {
    screen: "paper-home",
    label: "Paper search",
    selector: 'main input[aria-label="Search Paper"]',
    composedScreen: PAPER_LIBRARY,
    frame: "LYZTY",
    props: ["width", "height", "radius"],
  },
  {
    screen: "paper-home",
    label: "Paper body",
    selector: PAPER_SECTION,
    composedScreen: PAPER_LIBRARY,
    frame: "P5JGNu",
    props: [...PADDING, "gap"],
  },
  {
    screen: "paper-home",
    label: "Paper card row",
    selector: `${PAPER_SECTION} > div:nth-of-type(3)`,
    composedScreen: PAPER_LIBRARY,
    frame: "t3Jvb",
    props: ["gap"],
  },
  {
    screen: "apply-board",
    label: "Apply page header",
    selector: '[data-slot="page-header"]',
    composedScreen: APPLY_BOARD,
    frame: "x7oSw0",
    props: ["height", "paddingLeft", "paddingRight", "gap"],
  },
  {
    screen: "apply-board",
    label: "Apply page title type",
    selector: '[data-slot="page-header-title"]',
    composedScreen: APPLY_BOARD,
    frame: "NzY69",
    props: ["fontSize"],
  },
  {
    screen: "apply-board",
    label: "Apply toolbar",
    selector: '[data-slot="apply-toolbar"]',
    composedScreen: APPLY_BOARD,
    frame: "nj3lB",
    props: ["height", "paddingLeft", "gap"],
  },
  {
    screen: "apply-board",
    label: "Apply toolbar under the header",
    selector: '[data-slot="apply-toolbar"]',
    from: '[data-slot="page-header"]',
    composedScreen: APPLY_BOARD,
    frame: "nj3lB",
    props: ["below"],
  },
  {
    screen: "apply-board",
    label: "Apply board",
    selector: '[data-slot="apply-board"]',
    composedScreen: APPLY_BOARD,
    frame: "Z0qXiK",
    props: [...PADDING, "gap"],
  },
  {
    screen: "apply-board",
    label: "Apply column",
    selector: '[data-slot="kanban-board"]',
    composedScreen: APPLY_BOARD,
    frame: "m9KSJZ",
    props: ["width", "radius", ...PADDING, "gap"],
  },
  {
    screen: "apply-board",
    label: "Apply column head",
    selector: '[data-slot="board-lane"]',
    composedScreen: APPLY_BOARD,
    frame: "qlpq8",
    props: ["height", "paddingLeft", "gap"],
  },
  {
    screen: "apply-board",
    label: "Apply job card",
    selector: '[data-slot="kanban-cards"] [data-slot="card"]',
    composedScreen: APPLY_BOARD,
    frame: "huQRr",
    props: ["radius", ...PADDING],
  },
  {
    screen: "coach-chat-finished",
    label: "Coach page header",
    selector: '[data-slot="page-header"]',
    composedScreen: COACH_WORKING,
    frame: "gnL5y",
    props: ["height", "paddingLeft", "paddingRight", "gap"],
  },
  {
    screen: "coach-chat-finished",
    label: "Coach page space under the header",
    selector: COACH_COLUMN,
    composedScreen: COACH_WORKING,
    frame: "OrczG",
    props: ["paddingTop"],
  },
  {
    screen: "coach-chat-finished",
    label: "Coach page message column",
    selector: COACH_COLUMN,
    composedScreen: COACH_WORKING,
    frame: "QNqkY",
    props: ["width", "gap"],
  },
  {
    screen: "coach-chat-finished",
    label: "Coach page user bubble",
    selector: '[data-slot="chat"] [data-slot="bubble-content"]',
    composedScreen: COACH_WORKING,
    frame: "HWFpW",
    props: ["radius", ...PADDING],
  },
  {
    screen: "coach-chat-finished",
    label: "Coach page composer",
    selector:
      '[data-slot="coach-workspace-composer"] [data-slot="coach-composer"]',
    composedScreen: COACH_WORKING,
    frame: "KDAaX",
    props: ["width", "height", "radius"],
  },
  {
    screen: "coach-chat-finished",
    label: "Coach page composer text inset",
    selector: '[data-slot="coach-workspace-composer"] textarea',
    composedScreen: COACH_WORKING,
    frame: "KDAaX",
    props: ["paddingTop", "paddingLeft"],
  },
  {
    screen: "coach-chat-finished",
    label: "Coach page composer toolbar inset",
    selector:
      '[data-slot="coach-workspace-composer"] [data-slot="input-group-addon"]',
    composedScreen: COACH_WORKING,
    frame: "KDAaX",
    props: ["paddingRight", "paddingBottom"],
  },
  {
    screen: "coach-chat-finished",
    label: "Coach reply action icon",
    selector: '[data-slot="chat"] [data-slot="message-actions"] svg',
    composedScreen: COACH_CAP_REACHED,
    frame: "VcwyA",
    props: ["width", "height"],
  },
  {
    screen: "coach-chat-finished",
    label: "Coach reply action row",
    selector: '[data-slot="chat"] [data-slot="message-actions"] svg',
    composedScreen: COACH_CAP_REACHED,
    frame: "mbdW5",
    props: ["pitch"],
  },
  {
    screen: "coach-chat-finished",
    label: "Coach reply action row at the column edge",
    selector: '[data-slot="chat"] [data-slot="message-actions"]',
    from: COACH_COLUMN,
    composedScreen: COACH_CAP_REACHED,
    frame: "mbdW5",
    props: ["left"],
  },
  {
    screen: "coach-approval",
    label: "Coach approval Approve button",
    selector: `${APPROVAL_CARD} [data-slot="button"][data-variant="primary"]`,
    composedScreen: DELETE_CONFIRM,
    frame: "aHNeR",
    props: ["height", "radius", "paddingLeft", "paddingRight"],
  },
  {
    screen: "coach-approval",
    label: "Coach approval Deny button",
    selector: `${APPROVAL_CARD} [data-slot="button"][data-variant="default"]`,
    composedScreen: DELETE_CONFIRM,
    frame: "w8dUCw",
    props: ["height", "radius", "paddingLeft", "paddingRight"],
  },
  ...["paper-blank", "paper-typed", "paper-letter-blank"].flatMap(
    writingPageRows
  ),
  {
    screen: "settings",
    label: "Settings nav",
    selector: '[data-slot="settings-layout"] aside',
    composedScreen: PREFERENCES,
    frame: "b6mQao",
    props: ["width", ...PADDING, "gap"],
  },
  {
    screen: "settings",
    label: "Settings nav item",
    selector: '[data-slot="settings-layout"] [data-slot="nav-item"]',
    composedScreen: PREFERENCES,
    frame: "rGQ1P",
    props: ["height", "radius", "paddingLeft", "paddingRight", "gap"],
  },
  {
    screen: "settings",
    label: "Settings content column",
    selector: '[data-slot="settings-layout"] main',
    composedScreen: PREFERENCES,
    frame: "MbGQO",
    props: ["width"],
  },
  {
    screen: "settings",
    label: "Settings title type",
    selector: '[data-slot="settings-title"] h1',
    composedScreen: PREFERENCES,
    frame: "E08nY",
    props: ["fontSize"],
  },
  {
    screen: "settings",
    label: "Settings card",
    selector: '[data-slot="settings-card"]',
    composedScreen: PREFERENCES,
    frame: "DUGTx",
    props: ["radius"],
  },
  {
    screen: "sign-in",
    label: "Sign-in email box",
    selector: 'input[type="email"]',
    composedScreen: SIGN_IN,
    frame: "KmGC0",
    props: ["height", "radius", "paddingLeft"],
  },
  {
    screen: "sign-in",
    label: "Sign-in continue button",
    selector: 'form button[type="submit"]',
    composedScreen: SIGN_IN,
    frame: "BXX35",
    props: ["height", "radius"],
  },
  {
    screen: "sign-in",
    label: "Sign-in heading type",
    selector: "h1",
    composedScreen: SIGN_IN,
    frame: "RnWqU",
    props: ["fontSize"],
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
    for (const prop of row.props ?? [])
      if (RELATIVE.includes(prop) && typeof row.from !== "string")
        problems.push(`${label}: ${prop} needs a from selector`)
    if (!Array.isArray(row.props) || row.props.length === 0)
      problems.push(`${label}: props is required`)
    for (const prop of row.props ?? [])
      if (!known.has(prop)) problems.push(`${label}: unknown property ${prop}`)
    problems.push(...ownerDecisionProblems(row, label))
    return problems
  })
}
