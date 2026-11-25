import {
  ASK_FOR_AN_EDIT,
  COMPOSER,
  DENY_THE_WAITING_EDIT,
  PANEL,
  PANEL_DENY,
  PANEL_EXPAND,
} from "../screen-steps.mjs"

export const screen = {
  id: "coach-approval-draft",
  route: "/paper",
  steps: [
    ...ASK_FOR_AN_EDIT,
    { clickIfShown: { selector: PANEL_EXPAND } },
    {
      fill: {
        selector: `${PANEL} ${COMPOSER}`,
        text: "Why this wording?",
      },
    },
    { waitFor: { selector: PANEL_DENY } },
  ],
  after: DENY_THE_WAITING_EDIT,
}
