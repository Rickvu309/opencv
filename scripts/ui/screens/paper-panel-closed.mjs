import { OPEN_BLANK_CV } from "../screen-steps.mjs"

export const screen = {
  id: "paper-panel-closed",
  route: "/paper",
  steps: [...OPEN_BLANK_CV, { waitFor: { selector: "[data-dock-coach]" } }],
}
