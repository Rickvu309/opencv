export const screen = {
  id: "inbox-scan",
  route: "/inbox",
  steps: [
    { waitFor: { role: "button", name: "Skip for now" } },
    { click: { role: "button", name: "Skip for now" } },
    { waitFor: { role: "button", name: "View example inbox" } },
    { click: { role: "button", name: "View example inbox" } },
    { waitFor: { text: "Regional bank" } },
  ],
}
