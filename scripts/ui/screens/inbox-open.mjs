export const screen = {
  id: "inbox-open",
  route: "/inbox",
  steps: [
    { waitFor: { role: "button", name: "View example inbox" } },
    { click: { role: "button", name: "View example inbox" } },
    { waitFor: { selector: '[data-slot="inbox-row"]' } },
    { click: { selector: '[data-slot="inbox-row"]' } },
    { waitFor: { role: "region", name: "Reading pane" } },
  ],
}
