export const screen = {
  id: "shell-sidebar-collapsed",
  route: "/jobs",
  restPointer: "center",
  steps: [
    { click: { role: "heading", name: "Jobs, matched to you" } },
    { press: "[" },
    { clickIfShown: { role: "button", name: "Menu" } },
    {
      waitFor: {
        selector:
          '[data-slot="sidebar-expand"], button[aria-label="Close menu"]',
      },
    },
  ],
}
