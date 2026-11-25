import { OPEN_NEW_CV, PAGE } from "../screen-steps.mjs"

export const screen = {
  id: "paper-home",
  route: "/paper",
  steps: [
    ...OPEN_NEW_CV,
    { click: { role: "radio", name: "Modern" } },
    { click: { role: "button", name: "Use Modern" } },
    { waitFor: { selector: PAGE } },
    { goto: "/paper" },
    ...OPEN_NEW_CV,
    { click: { role: "radio", name: "Simple" } },
    { click: { role: "button", name: "Use Simple" } },
    { waitFor: { selector: PAGE } },
    { goto: "/paper" },
    { waitFor: { text: "Simple CV" } },
    {
      waitFor: {
        selector: '[data-slot="app-dock"]:not(:has([data-chat-id]))',
      },
    },
  ],
}
