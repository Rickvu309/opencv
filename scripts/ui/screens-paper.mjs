const OPEN_NEW_CV = [
  { click: { role: "button", name: "New" } },
  { click: { role: "button", name: "CV" } },
  { waitFor: { role: "dialog", name: "New CV" } },
]

const HARD_NAMES = [
  "Senior Product Designer CV for the Atlassian Ho Chi Minh City design systems team, final version",
  "Nguyen_Van_A_CV_final_final_v12_2026_updated_for_Grab_and_Shopee",
  "Th\u01b0 xin vi\u1ec7c g\u1eedi C\u00f4ng ty C\u1ed5 ph\u1ea7n Th\u01b0\u01a1ng m\u1ea1i \u0110i\u1ec7n t\u1eed Tiki",
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
      id: "paper-home-many",
      route: "/paper",
      steps: [
        { paperDocs: { count: 40, names: HARD_NAMES } },
        { goto: "/paper" },
        { waitFor: { text: "Company 37" } },
      ],
    },
    {
      id: "paper-home-long-name",
      route: "/paper",
      steps: [
        {
          paperDocs: {
            count: 12,
            names: [
              "CV for Grab",
              "CV for Shopee",
              "Letter to MoMo",
              ...HARD_NAMES,
            ],
          },
        },
        { goto: "/paper" },
        { waitFor: { text: "Senior Product Designer CV" } },
      ],
    },
    {
      id: "paper-home-search-miss",
      route: "/paper",
      steps: [
        { paperDocs: { count: 2 } },
        { goto: "/paper" },
        { waitFor: { text: "Company 2" } },
        { fill: { role: "searchbox", name: "Search Paper", text: "zzz" } },
        { waitFor: { text: "Nothing matches" } },
      ],
    },
    {
      id: "paper-home-letters-empty",
      route: "/paper",
      steps: [
        { paperDocs: { count: 2 } },
        { goto: "/paper" },
        { waitFor: { text: "Company 2" } },
        { clickIfShown: { role: "button", name: "Letters" } },
        { clickIfShown: { role: "button", name: "Show All" } },
        { clickIfShown: { role: "menuitemradio", name: "Letters" } },
        { waitFor: { text: "No letters yet" } },
      ],
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
