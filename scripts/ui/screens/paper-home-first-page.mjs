export const screen = {
  id: "paper-home-first-page",
  route: "/paper",
  steps: [
    {
      paperFirstPages: {
        docs: [
          { name: "Product Designer CV", doc: "en-10" },
          { name: "Kỹ sư CV", doc: "vi-01" },
          { name: "Portrait CV", doc: "photo" },
          {
            name: "Typed out CV",
            lines: [
              "Ada Lovelace",
              "Engineer of calm tools",
              "Experience",
              "Northwind, Senior Engineer",
            ],
          },
        ],
      },
    },
    { goto: "/paper" },
    { waitFor: { selector: '[data-slot="paper-library-sheet"] .paper-line' } },
    {
      waitFor: {
        selector: '[data-slot="app-dock"]:not(:has([data-chat-id]))',
      },
    },
  ],
}
