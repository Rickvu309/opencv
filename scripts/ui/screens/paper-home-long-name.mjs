import { HARD_NAMES } from "../screen-steps.mjs"

export const screen = {
  id: "paper-home-long-name",
  route: "/paper",
  steps: [
    {
      paperDocs: {
        count: 12,
        names: [
          ...HARD_NAMES,
          "CV for Grab",
          "CV for Shopee",
          "Letter to MoMo",
        ],
      },
    },
    { goto: "/paper" },
    { waitFor: { text: "Senior Product Designer CV" } },
  ],
}
