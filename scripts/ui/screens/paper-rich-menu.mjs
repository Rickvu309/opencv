export const screen = {
  id: "paper-rich-menu",
  route: "/paper",
  steps: [
    { respond: { fixture: "rich-document" } },
    { clickIfShown: { role: "button", name: "Edit" } },
  ],
}
