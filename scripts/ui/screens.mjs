const COMPOSER = '[data-slot="coach-workspace-composer"] textarea'
const PAGE = '[contenteditable="true"]'
const SAVED = 'p.writing-note:text-is("Saved")'

const OPEN_BLANK_CV = [
  { goto: "/paper" },
  { click: { role: "button", name: "New" } },
  { click: { role: "button", name: "CV" } },
  { click: { role: "button", name: "Start blank" } },
  { waitFor: { selector: PAGE } },
]

const OPEN_TEMPLATE_CV = [
  { goto: "/paper" },
  { click: { role: "button", name: "New" } },
  { click: { role: "button", name: "CV" } },
  { click: { role: "button", name: "Use template" } },
  { waitFor: { selector: PAGE } },
]

const OPEN_PANEL = [
  { click: { selector: "[data-dock-coach]" } },
  { waitFor: { selector: '[data-slot="coach-panel"]' } },
]

const PANEL = '[data-slot="coach-panel"]'
const PANEL_UNDO = `${PANEL} button[aria-label="Undo"]`

const ASK_FOR_AN_EDIT = [
  ...OPEN_TEMPLATE_CV,
  ...OPEN_PANEL,
  {
    fill: {
      selector: `${PANEL} ${COMPOSER}`,
      text: "Please improve the summary",
    },
  },
  { press: "Enter" },
  { waitFor: { role: "button", name: "Deny" } },
]

const DENY_THE_WAITING_EDIT = [
  { click: { role: "button", name: "Deny" } },
  { waitFor: { text: "Denied · nothing changed" } },
]

const APPROVE_THE_EDIT = [
  ...ASK_FOR_AN_EDIT,
  { click: { role: "button", name: "Approve" } },
  { waitFor: { selector: PANEL_UNDO } },
]

const UNDO_THE_EDIT = [
  ...APPROVE_THE_EDIT,
  { click: { selector: PANEL_UNDO } },
  { waitFor: { text: "Undone" } },
]

const JOB_DIALOG = '[role="dialog"]'

const ADD_A_JOB = [
  { click: { role: "button", name: "New job" } },
  {
    fill: {
      selector: `${JOB_DIALOG} input[aria-label="Role title"]`,
      text: "Product designer",
    },
  },
  {
    fill: {
      selector: `${JOB_DIALOG} input[aria-label="Company"]`,
      text: "Lumiere",
    },
  },
  { click: { selector: `${JOB_DIALOG} button[aria-label="Add job"]` } },
  { waitFor: { text: "Product designer" } },
]

export const SCREENS = [
  {
    id: "sign-in",
    route: "/sign-in",
    signedIn: false,
    steps: [{ waitFor: { selector: 'input[type="email"]' } }],
  },
  {
    id: "coach-home",
    route: "/coach",
    steps: [{ waitFor: { selector: COMPOSER } }],
  },
  {
    id: "coach-chat-finished",
    route: "/coach",
    steps: [
      { fill: { selector: COMPOSER, text: "What should I do next?" } },
      { press: "Enter" },
      { waitFor: { text: "Prep the starred" } },
    ],
  },
  {
    id: "paper-home",
    route: "/paper",
    steps: [{ waitFor: { role: "heading", name: "Paper" } }],
  },
  {
    id: "paper-blank",
    route: "/paper",
    steps: OPEN_BLANK_CV,
  },
  {
    id: "paper-typed",
    route: "/paper",
    steps: [
      ...OPEN_BLANK_CV,
      { click: { selector: PAGE } },
      {
        type: "Ada Nguyen\nProduct designer in Hanoi. Five years of shipping.",
      },
      { waitFor: { selector: SAVED } },
    ],
  },
  {
    id: "paper-panel-open",
    route: "/paper",
    steps: [...OPEN_BLANK_CV, ...OPEN_PANEL],
  },
  {
    id: "apply-empty",
    route: "/apply",
    steps: [{ waitFor: { selector: "main" } }],
  },
  {
    id: "settings",
    route: "/settings",
    steps: [{ waitFor: { selector: "main" } }],
  },
  {
    id: "coach-chat-streaming",
    route: "/coach",
    unreachable:
      "The fake Coach replays its script with no delay, so the turn finishes before a frame can be captured; it needs a paced fake script",
  },
  {
    id: "paper-panel-closed",
    route: "/paper",
    steps: [...OPEN_BLANK_CV, { waitFor: { selector: "[data-dock-coach]" } }],
  },
  {
    id: "paper-panel-approval",
    route: "/paper",
    steps: ASK_FOR_AN_EDIT,
    after: DENY_THE_WAITING_EDIT,
  },
  {
    id: "paper-panel-receipt",
    route: "/paper",
    steps: APPROVE_THE_EDIT,
  },
  {
    id: "paper-panel-undone",
    route: "/paper",
    steps: UNDO_THE_EDIT,
  },
  {
    id: "coach-approval",
    route: "/paper",
    steps: [
      ...ASK_FOR_AN_EDIT,
      { click: { role: "button", name: "Expand" } },
      { waitFor: { role: "button", name: "Deny" } },
    ],
    after: DENY_THE_WAITING_EDIT,
  },
  {
    id: "coach-receipt",
    route: "/paper",
    steps: [
      ...APPROVE_THE_EDIT,
      { click: { role: "button", name: "Expand" } },
      { waitFor: { selector: PANEL_UNDO } },
    ],
  },
  {
    id: "coach-undone",
    route: "/paper",
    steps: [
      ...UNDO_THE_EDIT,
      { click: { role: "button", name: "Expand" } },
      { waitFor: { text: "Undone" } },
    ],
  },
  {
    id: "coach-denied",
    route: "/paper",
    steps: [
      ...ASK_FOR_AN_EDIT,
      { click: { role: "button", name: "Expand" } },
      { waitFor: { role: "button", name: "Deny" } },
      ...DENY_THE_WAITING_EDIT,
    ],
  },
  {
    id: "paper-proposal-card",
    route: "/paper",
    steps: [
      ...OPEN_BLANK_CV,
      ...OPEN_PANEL,
      {
        fill: {
          selector: `${PANEL} ${COMPOSER}`,
          text: "Please improve the summary",
        },
      },
      { press: "Enter" },
      { waitFor: { role: "button", name: "Approve", exact: true } },
      { waitFor: { selector: 'section[aria-label="Coach proposal"]' } },
    ],
    after: DENY_THE_WAITING_EDIT,
  },
  {
    id: "paper-imported",
    route: "/paper",
    steps: [
      { goto: "/paper" },
      {
        upload: {
          selector: 'input[type="file"]',
          file: "cv-bold-bullets.docx",
        },
      },
      { waitFor: { text: "Ran weekly design critiques" } },
      { waitFor: { selector: PAGE } },
    ],
  },
  {
    id: "paper-imported-formatted",
    route: "/paper",
    steps: [
      { goto: "/paper" },
      {
        upload: {
          selector: 'input[type="file"]',
          file: "cv-formatted.docx",
        },
      },
      { waitFor: { text: "Exchange term, Lyon" } },
      { waitFor: { selector: PAGE } },
    ],
  },
  {
    id: "apply-board",
    route: "/apply",
    steps: ADD_A_JOB,
  },
]

const STEP_KINDS = new Set([
  "goto",
  "click",
  "fill",
  "press",
  "type",
  "upload",
  "waitFor",
])
const ID = /^[a-z][a-z0-9-]*$/

export function validateScreens(screens) {
  const problems = []
  const seen = new Set()
  for (const screen of screens) {
    const label = screen.id ?? "(no id)"
    if (!ID.test(screen.id ?? ""))
      problems.push(`${label}: id must be kebab-case`)
    if (seen.has(screen.id)) problems.push(`${label}: duplicate id`)
    seen.add(screen.id)
    if (!String(screen.route ?? "").startsWith("/"))
      problems.push(`${label}: route must start with /`)
    const hasSteps = Array.isArray(screen.steps)
    const hasReason =
      typeof screen.unreachable === "string" && screen.unreachable.length > 0
    if (hasSteps === hasReason)
      problems.push(`${label}: needs steps or an unreachable reason, not both`)
    if (
      screen.after !== undefined &&
      !(hasSteps && Array.isArray(screen.after))
    )
      problems.push(
        `${label}: after must be a step list on a screen with steps`
      )
    for (const step of [...(screen.steps ?? []), ...(screen.after ?? [])]) {
      const kinds = Object.keys(step)
      if (kinds.length !== 1 || !STEP_KINDS.has(kinds[0]))
        problems.push(
          `${label}: step ${JSON.stringify(step)} must be one of ${[...STEP_KINDS].join(", ")}`
        )
    }
  }
  return problems
}

export function pickScreens(screens, ids) {
  const byId = new Map(screens.map((screen) => [screen.id, screen]))
  const missing = ids.filter((id) => !byId.has(id))
  return {
    found: ids.filter((id) => byId.has(id)).map((id) => byId.get(id)),
    missing,
  }
}

const HEIGHTS = new Map([
  [1440, 900],
  [1280, 800],
  [390, 844],
])

export function viewportFor(width) {
  return { width, height: HEIGHTS.get(width) ?? Math.round((width * 10) / 16) }
}

export function shotName(screenId, width, scale) {
  return `${screenId}-${width}${scale > 1 ? `@${scale}x` : ""}.png`
}
