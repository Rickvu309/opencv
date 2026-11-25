import { OPEN_BLANK_CV, PAGE, SAVED } from "../screen-steps.mjs"

export const screen = {
  id: "paper-typed",
  route: "/paper",
  steps: [
    ...OPEN_BLANK_CV,
    { click: { selector: PAGE } },
    {
      type: "Ada Nguyen\nProduct designer in Hanoi. Five years of shipping.",
    },
    { waitFor: { selector: SAVED } },
  ],
}
