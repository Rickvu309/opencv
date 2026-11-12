const COMPOSER = '[data-slot="coach-workspace-composer"] textarea'
const PAGE = '[contenteditable="true"]'

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

const FAKE_COACH_NO_APPROVAL =
  "The fake Coach (apps/api/src/coach/fake.ts) proposes no tool that needs approval on the Coach page, and on a Word page its paper.edit outline insert is refused by apps/api/src/coach/worker.ts with 'This edit does not match the saved document.', so no approval is ever shown"

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
    id: "coach-approval",
    route: "/coach",
    unreachable: FAKE_COACH_NO_APPROVAL,
  },
  { id: "coach-receipt", route: "/coach", unreachable: FAKE_COACH_NO_APPROVAL },
  { id: "coach-undone", route: "/coach", unreachable: FAKE_COACH_NO_APPROVAL },
  {
    id: "paper-panel-approval",
    route: "/paper",
    unreachable: FAKE_COACH_NO_APPROVAL,
  },
  {
    id: "paper-proposal-card",
    route: "/paper",
    unreachable: FAKE_COACH_NO_APPROVAL,
  },
  {
    id: "paper-imported",
    route: "/paper",
    unreachable:
      "The repo has no .docx fixture file; apps/api/src/paper/package-fixtures.ts builds Word packages in code, so a file must be written before the import dialog can take it",
  },
  {
    id: "apply-board",
    route: "/apply",
    unreachable:
      "Not scripted yet: needs the steps that add a Job through the Add job form",
  },
]

const STEP_KINDS = new Set([
  "goto",
  "click",
  "fill",
  "press",
  "type",
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
    for (const step of screen.steps ?? []) {
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
