export const COMPOSER = '[data-slot="coach-workspace-composer"] textarea'
export const PAGE = '[contenteditable="true"]'
export const SAVED =
  'p.writing-note[title="Saved"], p.writing-note:text-is("Saved")'

export const OPEN_NEW_CV = [
  { click: { role: "button", name: "New" } },
  { click: { role: "button", name: "CV" } },
  { waitFor: { role: "dialog", name: "New CV" } },
]

export const OPEN_BLANK_CV = [
  { goto: "/paper" },
  ...OPEN_NEW_CV,
  { click: { role: "radio", name: "Blank" } },
  { click: { role: "button", name: "Start blank" } },
  { waitFor: { selector: PAGE } },
]

export const OPEN_PANEL = [
  { click: { selector: "[data-dock-coach]" } },
  { waitFor: { selector: '[data-slot="coach-panel"]' } },
]

export const PANEL = '[data-slot="coach-panel"]'
export const PANEL_UNDO = `${PANEL} button[aria-label="Undo"]`
export const PANEL_APPROVE = `${PANEL} button:text-is("Approve")`
export const PANEL_DENY = `${PANEL} button:text-is("Deny")`
export const PANEL_EXPAND = `${PANEL} button[aria-label="Expand"]`
export const PANEL_UNDONE = `${PANEL} [data-slot="coach-action-record"][data-state="undone"]`
export const PANEL_DENIED = `${PANEL} :text("nothing changed")`
const PANEL_IDLE = `${PANEL} button[aria-label="Send"]:not([aria-describedby])`

export const ASK_FOR_AN_EDIT = [
  ...OPEN_BLANK_CV,
  ...OPEN_PANEL,
  {
    fill: {
      selector: `${PANEL} ${COMPOSER}`,
      text: "Please improve the summary",
    },
  },
  { press: "Enter" },
  { waitFor: { selector: PANEL_DENY } },
]

export const DENY_THE_WAITING_EDIT = [
  { click: { selector: PANEL_DENY } },
  { waitFor: { selector: PANEL_DENIED } },
  { waitFor: { selector: PANEL_IDLE } },
]

export const APPROVE_THE_EDIT = [
  ...ASK_FOR_AN_EDIT,
  { click: { selector: PANEL_APPROVE } },
  { waitFor: { selector: PANEL_UNDO } },
]

export const UNDO_THE_EDIT = [
  ...APPROVE_THE_EDIT,
  { click: { selector: PANEL_UNDO } },
  { waitFor: { selector: PANEL_UNDONE } },
]

export const REOPEN_LATEST_CHAT = [
  { goto: "/paper" },
  { waitFor: { role: "heading", name: "Paper" } },
  { click: { selector: '[data-slot="dock-recent"] button' } },
  { waitFor: { selector: PANEL } },
]

export const DOWNLOAD_READY = { role: "link", name: "Download Word" }

const JOB_DIALOG = '[role="dialog"]'

export const ADD_A_JOB = [
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

export const OPEN_THE_JOB = [
  ...ADD_A_JOB,
  { click: { role: "button", name: "Product designer, Lumiere" } },
  { waitFor: { selector: '[data-slot="apply-peek-body"]' } },
]

export const OPEN_THE_STAGE_MENU = [
  ...OPEN_THE_JOB,
  { press: "Escape" },
  { press: "s" },
  { waitFor: { selector: '[data-slot="stage-menu"]' } },
]
