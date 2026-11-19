import {
  ADD_A_JOB,
  COMPOSER,
  OPEN_PANEL,
  OPEN_THE_JOB,
  OPEN_THE_STAGE_MENU,
  PANEL,
} from "./screen-steps.mjs"
import { COACH_SCREENS } from "./screens-coach.mjs"
import { PAPER_SCREENS } from "./screens-paper.mjs"

export const SCREENS = [
  {
    id: "sign-in",
    route: "/sign-in",
    signedIn: false,
    steps: [{ waitFor: { selector: 'input[type="email"]' } }],
  },
  {
    id: "sign-in-invalid-email",
    route: "/sign-in",
    signedIn: false,
    steps: [
      { waitFor: { selector: 'input[type="email"]' } },
      { fill: { selector: 'input[type="email"]', text: "ada" } },
      { click: { role: "button", name: "Continue" } },
      { waitFor: { selector: 'input[type="email"][aria-invalid="true"]' } },
    ],
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
  ...COACH_SCREENS,
  ...PAPER_SCREENS,
  {
    id: "apply-empty",
    route: "/apply",
    steps: [{ waitFor: { role: "heading", name: "Track your first job" } }],
  },
  {
    id: "apply-board",
    route: "/apply",
    steps: ADD_A_JOB,
  },
  {
    id: "apply-peek",
    route: "/apply",
    steps: OPEN_THE_JOB,
  },
  {
    id: "apply-stage-menu",
    route: "/apply",
    steps: OPEN_THE_STAGE_MENU,
  },
  {
    id: "apply-next-up",
    route: "/apply",
    steps: [
      ...OPEN_THE_STAGE_MENU,
      { press: "4" },
      { waitFor: { text: "Answer the offer" } },
    ],
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
      { waitFor: { selector: `${PANEL} :text("Prep the starred")` } },
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
    steps: [{ waitFor: { role: "heading", name: "Inbox" } }],
  },
  {
    id: "inbox-skipped",
    route: "/inbox",
    steps: [
      { waitFor: { role: "button", name: "Skip for now" } },
      { click: { role: "button", name: "Skip for now" } },
      { waitFor: { text: "No job emails yet" } },
    ],
  },
  {
    id: "inbox-scan",
    route: "/inbox",
    steps: [
      { waitFor: { role: "button", name: "Skip for now" } },
      { click: { role: "button", name: "Skip for now" } },
      { waitFor: { role: "button", name: "View example inbox" } },
      { click: { role: "button", name: "View example inbox" } },
      { waitFor: { text: "Regional bank" } },
    ],
  },
  {
    id: "inbox-open",
    route: "/inbox",
    steps: [
      { waitFor: { role: "button", name: "View example inbox" } },
      { click: { role: "button", name: "View example inbox" } },
      { waitFor: { selector: '[data-slot="inbox-row"]' } },
      { click: { selector: '[data-slot="inbox-row"]' } },
      { waitFor: { role: "region", name: "Reading pane" } },
    ],
  },
  {
    id: "shell-sidebar-collapsed",
    route: "/jobs",
    restPointer: "center",
    steps: [
      { click: { role: "heading", name: "Jobs, matched to you" } },
      { press: "[" },
      { clickIfShown: { role: "button", name: "Menu" } },
      {
        waitFor: {
          selector:
            '[data-slot="sidebar-expand"], button[aria-label="Close menu"]',
        },
      },
    ],
  },
  {
    id: "shell-command-palette",
    route: "/inbox",
    steps: [
      { waitFor: { role: "heading", name: "Inbox" } },
      { press: "Control+k" },
      {
        waitFor: {
          selector: '[role="dialog"] input[aria-label="Search"]',
        },
      },
    ],
  },
  {
    id: "shell-menu-open",
    route: "/inbox",
    steps: [
      { waitFor: { role: "heading", name: "Inbox" } },
      {
        clickIfShown: {
          selector: '[data-slot="sidebar-frame"] [data-slot="account-trigger"]',
        },
      },
      { clickIfShown: { role: "button", name: "Menu" } },
      {
        waitFor: {
          selector: 'button[aria-label="Close menu"], [role="menu"]',
        },
      },
    ],
  },
  {
    id: "jobs",
    route: "/jobs",
    steps: [{ waitFor: { role: "heading", name: "Jobs, matched to you" } }],
  },
  {
    id: "pitch",
    route: "/pitch",
    steps: [{ waitFor: { role: "heading", name: "One link that sells you" } }],
  },
  {
    id: "proofs",
    route: "/proofs",
    steps: [{ waitFor: { role: "heading", name: "Back your CV with proof" } }],
  },
]

const STEP_KINDS = new Set([
  "goto",
  "click",
  "clickIfShown",
  "fill",
  "press",
  "type",
  "upload",
  "waitFor",
  "respond",
  "paperDocs",
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
      if (step.click?.text !== undefined)
        problems.push(
          `${label}: step ${JSON.stringify(step)} clicks by text, which takes the first match even where a layout hides it; click by role and name`
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

export function restPoint(screen, viewport) {
  if (screen?.restPointer !== "center" || !viewport?.width || !viewport?.height)
    return { x: 0, y: 0 }
  return {
    x: Math.round(viewport.width / 2),
    y: Math.round(viewport.height / 2),
  }
}

export function viewportFor(width) {
  return { width, height: HEIGHTS.get(width) ?? Math.round((width * 10) / 16) }
}

export function shotName(screenId, width, scale) {
  return `${screenId}-${width}${scale > 1 ? `@${scale}x` : ""}.png`
}
