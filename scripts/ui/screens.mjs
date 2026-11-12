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

const OPEN_PANEL = [
  { click: { selector: "[data-dock-coach]" } },
  { waitFor: { selector: '[data-slot="coach-panel"]' } },
]

const PANEL = '[data-slot="coach-panel"]'
const PANEL_UNDO = `${PANEL} button[aria-label="Undo"]`

const ASK_FOR_AN_EDIT = [
  ...OPEN_BLANK_CV,
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

const STOP_THE_WAITING_EDIT = [
  { click: { selector: `${PANEL} button[aria-label="Stop"]` } },
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

const REOPEN_LATEST_CHAT = [
  { goto: "/paper" },
  { waitFor: { role: "heading", name: "Paper" } },
  { click: { selector: '[data-slot="dock-recent"] button' } },
  { waitFor: { selector: PANEL } },
]

const DOWNLOAD_READY = { role: "link", name: "Download Word" }

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
    id: "sign-in-too-many-codes",
    route: "/sign-in",
    signedIn: false,
    steps: [
      { waitFor: { selector: 'input[type="email"]' } },
      {
        respond: {
          path: "/api/auth/email-otp/send-verification-otp",
          status: 429,
          headers: { "Retry-After": "661" },
          json: { message: "Too many requests. Please try again later." },
        },
      },
      { fill: { selector: 'input[type="email"]', text: "ada@example.com" } },
      { click: { role: "button", name: "Continue" } },
      { waitFor: { selector: '[role="alert"]' } },
    ],
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
    steps: [
      ...OPEN_BLANK_CV,
      { goto: "/paper" },
      { waitFor: { selector: 'main input[aria-label="Search Paper"]' } },
    ],
  },
  {
    id: "paper-home-empty",
    route: "/paper",
    steps: [{ waitFor: { text: "Start a document" } }],
  },
  {
    id: "paper-home-panel-open",
    route: "/paper",
    steps: [
      { waitFor: { selector: 'main input[aria-label="Search Paper"]' } },
      ...OPEN_PANEL,
    ],
  },
  {
    id: "paper-home-new-cv",
    route: "/paper",
    steps: [
      { click: { role: "button", name: "New CV" } },
      { waitFor: { role: "dialog", name: "New CV" } },
    ],
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
    steps: [{ waitFor: { role: "heading", name: "Track your first job" } }],
  },
  {
    id: "settings",
    route: "/settings",
    steps: [{ waitFor: { selector: '[data-slot="settings-card"]' } }],
  },
  ...[
    ["settings-coach", "/settings/coach", '[data-slot="settings-card"]'],
    [
      "settings-integrations",
      "/settings/integrations",
      "#agent-connections-title",
    ],
    ["settings-usage", "/settings/usage", '[data-slot="settings-card"]'],
    [
      "settings-billing",
      "/settings/billing",
      'main :is(h2, h3):has-text("Free plan")',
    ],
    ["settings-account", "/settings/account", '[data-slot="settings-card"]'],
  ].map(([id, route, selector]) => ({
    id,
    route,
    steps: [{ waitFor: { selector } }],
  })),
  {
    id: "settings-panel-open",
    route: "/settings",
    steps: [
      { waitFor: { selector: '[data-slot="settings-card"]' } },
      ...OPEN_PANEL,
      {
        fill: {
          selector: `${PANEL} ${COMPOSER}`,
          text: "What should I do next?",
        },
      },
      { press: "Enter" },
      { waitFor: { text: "Prep the starred" } },
    ],
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
  {
    id: "coach-denied-reloaded",
    route: "/paper",
    steps: [
      ...ASK_FOR_AN_EDIT,
      ...DENY_THE_WAITING_EDIT,
      ...REOPEN_LATEST_CHAT,
      { waitFor: { text: "Denied · nothing changed" } },
    ],
  },
  {
    id: "coach-receipt-reloaded",
    route: "/paper",
    steps: [
      ...APPROVE_THE_EDIT,
      ...REOPEN_LATEST_CHAT,
      { waitFor: { selector: PANEL_UNDO } },
    ],
  },
  {
    id: "coach-undone-reloaded",
    route: "/paper",
    steps: [
      ...UNDO_THE_EDIT,
      ...REOPEN_LATEST_CHAT,
      { waitFor: { text: "Undone" } },
    ],
  },
  {
    id: "coach-stopped-reloaded",
    route: "/paper",
    steps: [
      ...ASK_FOR_AN_EDIT,
      ...STOP_THE_WAITING_EDIT,
      ...REOPEN_LATEST_CHAT,
      { waitFor: { text: "Stopped · ask Coach again" } },
    ],
  },
  {
    id: "coach-expired-reloaded",
    route: "/paper",
    unreachable:
      "An approval reads as Expired only after it waits 24 hours unanswered, and the scripted runtime has no clock to move past that wait",
  },
  {
    id: "coach-unreadable-step",
    route: "/paper",
    unreachable:
      "A saved step reads as This step could not be read only when its stored part fails the part schema, and every writer checks the schema first, so it needs a direct edit of chat_messages.parts in the database",
  },
  {
    id: "paper-letter-blank",
    route: "/paper",
    steps: [
      { goto: "/paper" },
      { click: { role: "button", name: "New" } },
      { click: { role: "button", name: "Cover letter" } },
      { click: { selector: '[data-slot="letter-start-blank"]' } },
      { waitFor: { selector: PAGE } },
      { waitFor: DOWNLOAD_READY },
    ],
  },
  {
    id: "paper-letter-drafted",
    route: "/apply",
    steps: [
      ...ADD_A_JOB,
      { goto: "/paper" },
      { click: { role: "button", name: "New" } },
      { click: { role: "button", name: "Cover letter" } },
      { click: { role: "button", name: "Product designer, Lumiere" } },
      { click: { role: "button", name: "Draft letter" } },
      { waitFor: { text: "Coach is writing" } },
      { click: { role: "button", name: "Stop" } },
      { waitFor: { selector: PAGE } },
    ],
  },
  {
    id: "paper-download-held",
    route: "/paper",
    unreachable:
      "Download Word is held only between a keystroke and its save; the page saves within a second and shot waits for the network to settle, so every capture shows the ready link",
  },
  {
    id: "paper-download-ready",
    route: "/paper",
    steps: [
      { goto: "/paper" },
      {
        upload: {
          selector: 'input[type="file"]',
          file: "cv-formatted.docx",
        },
      },
      { waitFor: { selector: PAGE } },
      { waitFor: DOWNLOAD_READY },
    ],
  },
  {
    id: "landing",
    route: "/",
    signedIn: false,
    steps: [{ waitFor: { selector: "#landing-hero" } }],
  },
  {
    id: "inbox",
    route: "/inbox",
    unreachable:
      "Inbox is a hidden surface (apps/web/src/lib/product-paths.ts shown: false), so /inbox sends a signed-in person to the start page",
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
  "respond",
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
