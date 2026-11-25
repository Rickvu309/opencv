import { COMPOSER, OPEN_PANEL, PANEL } from "../screen-steps.mjs"

export const screen = {
  id: "settings-panel-open",
  route: "/settings",
  steps: [
    { waitFor: { selector: '[data-slot="settings-card"]' } },
    ...OPEN_PANEL,
    {
      fill: {
        selector: `${PANEL} ${COMPOSER}`,
        text: "What should I do next?",
      },
    },
    { press: "Enter" },
    { waitFor: { selector: `${PANEL} :text("Prep the starred")` } },
  ],
}
