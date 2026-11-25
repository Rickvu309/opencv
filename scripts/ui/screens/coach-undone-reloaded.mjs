import {
  PANEL_UNDONE,
  REOPEN_LATEST_CHAT,
  UNDO_THE_EDIT,
} from "../screen-steps.mjs"

export const screen = {
  id: "coach-undone-reloaded",
  route: "/paper",
  steps: [
    ...UNDO_THE_EDIT,
    ...REOPEN_LATEST_CHAT,
    { waitFor: { selector: PANEL_UNDONE } },
  ],
}
