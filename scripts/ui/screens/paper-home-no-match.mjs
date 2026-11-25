import { OPEN_BLANK_CV } from "../screen-steps.mjs"

export const screen = {
  id: "paper-home-no-match",
  route: "/paper",
  steps: [
    ...OPEN_BLANK_CV,
    { goto: "/paper" },
    {
      fill: {
        selector: 'main input[aria-label="Search Paper"]',
        text: "zzzz-no-match",
      },
    },
    { waitFor: { role: "button", name: "Clear search" } },
  ],
}
