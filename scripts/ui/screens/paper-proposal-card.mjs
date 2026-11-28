import {
  COMPOSER,
  DENY_THE_WAITING_EDIT,
  OPEN_BLANK_CV,
  OPEN_PANEL,
  PANEL,
  PANEL_APPROVE,
} from "../screen-steps.mjs"

export const screen = {
  id: "paper-proposal-card",
  route: "/paper",
  steps: [
    ...OPEN_BLANK_CV,
    ...OPEN_PANEL,
    {
      fill: {
        selector: `${PANEL} ${COMPOSER}`,
        text: "Please improve the summary",
      },
    },
    { press: "Enter" },
    { waitFor: { selector: PANEL_APPROVE } },
    { waitFor: { selector: 'section[aria-label="Coach suggestions"]' } },
  ],
  after: DENY_THE_WAITING_EDIT,
}
