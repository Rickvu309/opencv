import { ASK_FOR_AN_EDIT, DENY_THE_WAITING_EDIT } from "../screen-steps.mjs"

export const screen = {
  id: "paper-panel-approval",
  route: "/paper",
  steps: ASK_FOR_AN_EDIT,
  after: DENY_THE_WAITING_EDIT,
}
