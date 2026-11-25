import { OPEN_BLANK_CV } from "../screen-steps.mjs"

export const screen = {
  id: "paper-home-blank-copied",
  route: "/paper",
  steps: [
    ...OPEN_BLANK_CV,
    { goto: "/paper" },
    { click: { role: "button", name: "Untitled CV menu" } },
    { click: { role: "menuitem", name: "Duplicate" } },
    { waitFor: { text: "Copy of Untitled CV" } },
  ],
}
