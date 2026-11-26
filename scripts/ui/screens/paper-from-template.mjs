import { OPEN_NEW_CV, PAGE } from "../screen-steps.mjs"

export const screen = {
  id: "paper-from-template",
  route: "/paper",
  steps: [
    { goto: "/paper" },
    ...OPEN_NEW_CV,
    { click: { role: "radio", name: "Modern" } },
    { click: { role: "button", name: "Use Modern" } },
    { waitFor: { text: "[Your name]" } },
    { waitFor: { selector: PAGE } },
  ],
}
