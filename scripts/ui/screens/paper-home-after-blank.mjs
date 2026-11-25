import { OPEN_BLANK_CV } from "../screen-steps.mjs"

export const screen = {
  id: "paper-home-after-blank",
  route: "/paper",
  steps: [
    ...OPEN_BLANK_CV,
    { goto: "/paper" },
    { waitFor: { text: "Untitled CV" } },
  ],
}
