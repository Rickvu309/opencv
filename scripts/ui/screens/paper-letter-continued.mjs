import { screen as drafted } from "./paper-letter-drafted.mjs"

export const screen = {
  id: "paper-letter-continued",
  route: "/apply",
  steps: [
    ...drafted.steps,
    { click: { role: "button", name: "Continue drafting" } },
    { waitFor: { text: "I looked at the context." } },
  ],
}
