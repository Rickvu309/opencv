import { ADD_A_JOB } from "../screen-steps.mjs"

export const screen = {
  id: "paper-home-new-letter",
  route: "/apply",
  steps: [
    ...ADD_A_JOB,
    { goto: "/paper" },
    { click: { role: "button", name: "New" } },
    { click: { role: "button", name: "Cover letter" } },
    {
      waitFor: {
        selector: '[data-slot="letter-start-page"], [data-template-gallery]',
      },
    },
  ],
}
