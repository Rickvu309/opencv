import { OPEN_THE_STAGE_MENU } from "../screen-steps.mjs"

export const screen = {
  id: "apply-next-up",
  route: "/apply",
  steps: [
    ...OPEN_THE_STAGE_MENU,
    { press: "4" },
    { waitFor: { text: "Answer the offer" } },
  ],
}
