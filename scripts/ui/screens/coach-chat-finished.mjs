import { COMPOSER } from "../screen-steps.mjs"

export const screen = {
  id: "coach-chat-finished",
  route: "/coach",
  steps: [
    { fill: { selector: COMPOSER, text: "What should I do next?" } },
    { press: "Enter" },
    { waitFor: { text: "Prep the starred" } },
  ],
}
