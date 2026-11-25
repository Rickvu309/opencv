import { HARD_NAMES } from "../screen-steps.mjs"

export const screen = {
  id: "paper-home-many",
  route: "/paper",
  steps: [
    { paperDocs: { count: 40, names: HARD_NAMES } },
    { goto: "/paper" },
    { waitFor: { text: "Senior Product Designer CV" } },
  ],
}
