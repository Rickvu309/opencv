export const screen = {
  id: "paper-lab-downloads",
  route: "/paper-lab",
  steps: [
    { paperDocs: { importWord: "en-03" } },
    { click: { role: "button", name: "File" } },
    {
      waitFor: {
        selector:
          '[role="menuitem"]:not([aria-disabled="true"]):text("Download Word")',
      },
    },
    {
      waitFor: {
        selector:
          '[role="menuitem"]:not([aria-disabled="true"]):text("Download PDF")',
      },
    },
  ],
  after: [{ press: "Escape" }],
}
