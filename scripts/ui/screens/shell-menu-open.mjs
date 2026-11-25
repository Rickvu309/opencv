export const screen = {
  id: "shell-menu-open",
  route: "/inbox",
  steps: [
    { waitFor: { role: "heading", name: "Inbox" } },
    {
      clickIfShown: {
        selector: '[data-slot="sidebar-frame"] [data-slot="account-trigger"]',
      },
    },
    { clickIfShown: { role: "button", name: "Menu" } },
    {
      waitFor: {
        selector: 'button[aria-label="Close menu"], [role="menu"]',
      },
    },
  ],
}
