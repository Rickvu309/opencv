import { PANEL_EXPAND, PANEL_UNDONE, UNDO_THE_EDIT } from "../screen-steps.mjs"

export const screen = {
  id: "coach-undone",
  route: "/paper",
  steps: [
    ...UNDO_THE_EDIT,
    { clickIfShown: { selector: PANEL_EXPAND } },
    { waitFor: { selector: PANEL_UNDONE } },
  ],
}
