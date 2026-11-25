import {
  ASK_FOR_AN_EDIT,
  DENY_THE_WAITING_EDIT,
  PANEL_DENY,
  PANEL_EXPAND,
} from "../screen-steps.mjs"

export const screen = {
  id: "coach-denied",
  route: "/paper",
  steps: [
    ...ASK_FOR_AN_EDIT,
    { clickIfShown: { selector: PANEL_EXPAND } },
    { waitFor: { selector: PANEL_DENY } },
    ...DENY_THE_WAITING_EDIT,
  ],
}
