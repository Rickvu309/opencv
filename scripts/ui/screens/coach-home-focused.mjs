import { COMPOSER } from "../screen-steps.mjs"

export const screen = {
  id: "coach-home-focused",
  route: "/coach",
  steps: [
    { click: { selector: COMPOSER } },
    { fill: { selector: COMPOSER, text: "Help me prep for Friday" } },
  ],
}
