export const screen = {
  id: "settings-billing",
  route: "/settings/billing",
  steps: [{ waitFor: { selector: 'main :is(h2, h3):has-text("Free plan")' } }],
}
