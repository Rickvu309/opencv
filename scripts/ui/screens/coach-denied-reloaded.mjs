import {
  ASK_FOR_AN_EDIT,
  DENY_THE_WAITING_EDIT,
  PANEL_DENIED,
  REOPEN_LATEST_CHAT,
} from "../screen-steps.mjs"

export const screen = {
  id: "coach-denied-reloaded",
  route: "/paper",
  steps: [
    ...ASK_FOR_AN_EDIT,
    ...DENY_THE_WAITING_EDIT,
    ...REOPEN_LATEST_CHAT,
    { waitFor: { selector: PANEL_DENIED } },
  ],
}
