import { OPEN_BLANK_CV, OPEN_PANEL } from "../screen-steps.mjs"

export const screen = {
  id: "paper-panel-open",
  route: "/paper",
  steps: [...OPEN_BLANK_CV, ...OPEN_PANEL],
}
