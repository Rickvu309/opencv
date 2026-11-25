export const screen = {
  id: "paper-rich-outline",
  route: "/paper",
  steps: [
    { respond: { fixture: "rich-document" } },
    { clickIfShown: { role: "button", name: "Document outline" } },
  ],
}
