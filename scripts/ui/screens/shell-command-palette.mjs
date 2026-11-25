export const screen = {
  id: "shell-command-palette",
  route: "/inbox",
  steps: [
    { waitFor: { role: "heading", name: "Inbox" } },
    { press: "Control+k" },
    {
      waitFor: {
        selector: '[role="dialog"] input[aria-label="Search"]',
      },
    },
  ],
}
