export const screen = {
  id: "inbox-skipped",
  route: "/inbox",
  steps: [
    { waitFor: { role: "button", name: "Skip for now" } },
    { click: { role: "button", name: "Skip for now" } },
    { waitFor: { text: "No job emails yet" } },
  ],
}
