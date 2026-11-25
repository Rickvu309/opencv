import { OPEN_BLANK_CV } from "../screen-steps.mjs"

export const screen = {
  id: "paper-home-blank-renamed",
  route: "/paper",
  steps: [
    ...OPEN_BLANK_CV,
    { goto: "/paper" },
    { click: { role: "button", name: "Untitled CV menu" } },
    { click: { role: "menuitem", name: "Rename" } },
    { fill: { selector: 'input[aria-label="Name"]', text: "Product CV" } },
    { press: "Enter" },
    { waitFor: { text: "Product CV" } },
  ],
}
