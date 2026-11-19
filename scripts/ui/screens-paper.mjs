const OPEN_NEW_CV = [
  { click: { role: "button", name: "New" } },
  { click: { role: "button", name: "CV" } },
  { waitFor: { role: "dialog", name: "New CV" } },
]

export function paperPickerScreens({ page, openPanel, addJob }) {
  return [
    {
      id: "paper-home",
      route: "/paper",
      steps: [
        ...OPEN_NEW_CV,
        { click: { role: "radio", name: "Modern" } },
        { click: { role: "button", name: "Use Modern" } },
        { waitFor: { selector: page } },
        { goto: "/paper" },
        ...OPEN_NEW_CV,
        { click: { role: "radio", name: "Simple" } },
        { click: { role: "button", name: "Use Simple" } },
        { waitFor: { selector: page } },
        { goto: "/paper" },
        { waitFor: { text: "Simple CV" } },
        {
          waitFor: {
            selector: '[data-slot="app-dock"]:not(:has([data-chat-id]))',
          },
        },
      ],
    },
    {
      id: "paper-home-empty",
      route: "/paper",
      steps: [{ waitFor: { text: "New Letter" } }],
    },
    {
      id: "paper-home-panel-open",
      route: "/paper",
      steps: [{ waitFor: { role: "heading", name: "Paper" } }, ...openPanel],
    },
    {
      id: "paper-home-new-cv",
      route: "/paper",
      steps: [...OPEN_NEW_CV, { click: { role: "radio", name: "Modern" } }],
    },
    {
      id: "paper-home-new-letter",
      route: "/apply",
      steps: [
        ...addJob,
        { goto: "/paper" },
        { click: { role: "button", name: "New" } },
        { click: { role: "button", name: "Cover letter" } },
        {
          waitFor: {
            selector:
              '[data-slot="letter-start-page"], [data-template-gallery]',
          },
        },
      ],
    },
    {
      id: "paper-new-cv-selected",
      route: "/paper",
      steps: [
        ...OPEN_NEW_CV,
        { click: { text: "Academic" } },
        { waitFor: { role: "dialog", name: "New CV" } },
      ],
    },
  ]
}
