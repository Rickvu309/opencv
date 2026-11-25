export const screen = {
  id: "paper-import-link",
  route: "/paper",
  steps: [
    { click: { role: "button", name: "Import" } },
    { waitFor: { role: "textbox", name: "Paste a link" } },
  ],
}
