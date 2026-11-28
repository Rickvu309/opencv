import { DOWNLOAD_READY, PAGE } from "../screen-steps.mjs"

export const screen = {
  id: "paper-letter-blank",
  route: "/paper",
  steps: [
    { goto: "/paper" },
    { click: { role: "button", name: "New" } },
    { click: { role: "button", name: "Cover letter" } },
    {
      click: {
        selector:
          '[data-slot="letter-start-blank"], [data-slot="paper-gallery-actions"] [data-variant="primary"]',
      },
    },
    { waitFor: { selector: PAGE } },
    ...DOWNLOAD_READY,
  ],
}
