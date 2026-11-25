import { ADD_A_JOB, PAGE } from "../screen-steps.mjs"

export const screen = {
  id: "paper-letter-drafted",
  route: "/apply",
  steps: [
    ...ADD_A_JOB,
    { goto: "/paper" },
    { click: { role: "button", name: "New" } },
    { click: { role: "button", name: "Cover letter" } },
    {
      clickIfShown: {
        role: "button",
        name: "Draft with Coach",
      },
    },
    { click: { role: "button", name: "Product designer, Lumiere" } },
    { click: { role: "button", name: "Draft letter" } },
    { waitFor: { text: "Coach is writing" } },
    { click: { role: "button", name: "Stop" } },
    { waitFor: { selector: PAGE } },
  ],
}
