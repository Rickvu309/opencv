import {
  APPROVE_THE_EDIT,
  PANEL_UNDO,
  REOPEN_LATEST_CHAT,
} from "../screen-steps.mjs"

export const screen = {
  id: "coach-receipt-reloaded",
  route: "/paper",
  steps: [
    ...APPROVE_THE_EDIT,
    ...REOPEN_LATEST_CHAT,
    { waitFor: { selector: PANEL_UNDO } },
  ],
}
