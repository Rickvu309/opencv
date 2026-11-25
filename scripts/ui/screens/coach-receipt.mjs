import { APPROVE_THE_EDIT, PANEL_EXPAND, PANEL_UNDO } from "../screen-steps.mjs"

export const screen = {
  id: "coach-receipt",
  route: "/paper",
  steps: [
    ...APPROVE_THE_EDIT,
    { clickIfShown: { selector: PANEL_EXPAND } },
    { waitFor: { selector: PANEL_UNDO } },
  ],
}
