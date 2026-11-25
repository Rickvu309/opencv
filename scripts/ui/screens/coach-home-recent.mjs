import { COMPOSER } from "../screen-steps.mjs"

export const screen = {
  id: "coach-home-recent",
  route: "/coach",
  steps: [
    { fill: { selector: COMPOSER, text: "What should I do next?" } },
    { press: "Enter" },
    { waitFor: { text: "Prep the starred" } },
    {
      click: {
        selector: '[data-surface="coach"] button[aria-label="New chat"]',
      },
    },
    { waitFor: { selector: '[data-slot="coach-recent-chats"]' } },
  ],
}
