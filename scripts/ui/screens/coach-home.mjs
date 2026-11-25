import { COMPOSER } from "../screen-steps.mjs"

export const screen = {
  id: "coach-home",
  route: "/coach",
  steps: [{ waitFor: { selector: COMPOSER } }],
}
