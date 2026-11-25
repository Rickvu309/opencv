import { OPEN_PANEL } from "../screen-steps.mjs"

export const screen = {
  id: "paper-home-panel-open",
  route: "/paper",
  steps: [{ waitFor: { role: "heading", name: "Paper" } }, ...OPEN_PANEL],
}
