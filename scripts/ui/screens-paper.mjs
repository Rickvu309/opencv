import {
  ADD_A_JOB,
  DOWNLOAD_READY,
  OPEN_BLANK_CV,
  OPEN_NEW_CV,
  OPEN_PANEL,
  PAGE,
  SAVED,
} from "./screen-steps.mjs"

const HARD_NAMES = [
  "Senior Product Designer CV for the Atlassian Ho Chi Minh City design systems team, final version",
  "Nguyen_Van_A_CV_final_final_v12_2026_updated_for_Grab_and_Shopee",
  "Th\u01b0 xin vi\u1ec7c g\u1eedi C\u00f4ng ty C\u1ed5 ph\u1ea7n Th\u01b0\u01a1ng m\u1ea1i \u0110i\u1ec7n t\u1eed Tiki",
]

export const PAPER_SCREENS = [
  {
    id: "paper-home",
    route: "/paper",
    steps: [
      ...OPEN_NEW_CV,
      { click: { role: "radio", name: "Modern" } },
      { click: { role: "button", name: "Use Modern" } },
      { waitFor: { selector: PAGE } },
      { goto: "/paper" },
      ...OPEN_NEW_CV,
      { click: { role: "radio", name: "Simple" } },
      { click: { role: "button", name: "Use Simple" } },
      { waitFor: { selector: PAGE } },
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
      { waitFor: { text: "Senior Product Designer CV" } },
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
            ...HARD_NAMES,
            "CV for Grab",
            "CV for Shopee",
            "Letter to MoMo",
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
    steps: [{ waitFor: { role: "heading", name: "Paper" } }, ...OPEN_PANEL],
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
      ...ADD_A_JOB,
      { goto: "/paper" },
      { click: { role: "button", name: "New" } },
      { click: { role: "button", name: "Cover letter" } },
      {
        waitFor: {
          selector: '[data-slot="letter-start-page"], [data-template-gallery]',
        },
      },
    ],
  },
  {
    id: "paper-new-cv-selected",
    route: "/paper",
    steps: [
      ...OPEN_NEW_CV,
      { click: { role: "radio", name: "Academic" } },
      { waitFor: { text: "Education leads, for students" } },
    ],
  },
  {
    id: "paper-blank",
    route: "/paper",
    steps: OPEN_BLANK_CV,
  },
  ...[
    ["paper-rich", []],
    [
      "paper-rich-selection",
      [
        {
          click: {
            selector: '.paper-rich-sheet [data-content-type="paragraph"]',
          },
        },
        { press: "Home" },
        { press: "Control+Shift+ArrowRight" },
      ],
    ],
    [
      "paper-rich-outline",
      [{ clickIfShown: { role: "button", name: "Document outline" } }],
    ],
  ].map(([id, steps]) => ({
    id,
    route: "/paper",
    steps: [{ respond: { fixture: "rich-document" } }, ...steps],
  })),
  {
    id: "paper-typed",
    route: "/paper",
    steps: [
      ...OPEN_BLANK_CV,
      { click: { selector: PAGE } },
      {
        type: "Ada Nguyen\nProduct designer in Hanoi. Five years of shipping.",
      },
      { waitFor: { selector: SAVED } },
    ],
  },
  {
    id: "paper-imported",
    route: "/paper",
    steps: [
      { goto: "/paper" },
      {
        upload: {
          selector: 'input[type="file"]',
          file: "cv-bold-bullets.docx",
        },
      },
      { waitFor: { text: "Ran weekly design critiques" } },
      { waitFor: { selector: PAGE } },
    ],
  },
  {
    id: "paper-imported-formatted",
    route: "/paper",
    steps: [
      { goto: "/paper" },
      {
        upload: {
          selector: 'input[type="file"]',
          file: "cv-formatted.docx",
        },
      },
      { waitFor: { text: "Exchange term, Lyon" } },
      { waitFor: { selector: PAGE } },
    ],
  },
  {
    id: "paper-imported-pdf",
    route: "/paper",
    steps: [
      { goto: "/paper" },
      {
        upload: {
          selector: 'input[type="file"]',
          file: "cv-text.pdf",
        },
      },
      { waitFor: { text: "Student Assistant, Example University" } },
      { waitFor: { selector: PAGE } },
    ],
  },
  {
    id: "paper-import-scanned",
    route: "/paper",
    steps: [
      { goto: "/paper" },
      {
        upload: {
          selector: 'input[type="file"]',
          file: "cv-scanned.pdf",
        },
      },
      { waitFor: { role: "heading", name: "Can't read this file" } },
    ],
  },
  {
    id: "paper-home-no-match",
    route: "/paper",
    steps: [
      ...OPEN_BLANK_CV,
      { goto: "/paper" },
      {
        fill: {
          selector: 'main input[aria-label="Search Paper"]',
          text: "zzzz-no-match",
        },
      },
      { waitFor: { role: "button", name: "Clear search" } },
    ],
  },
  {
    id: "paper-import-link",
    route: "/paper",
    steps: [
      { click: { role: "button", name: "Import" } },
      { waitFor: { role: "textbox", name: "Paste a link" } },
    ],
  },
  {
    id: "paper-letter-blank",
    route: "/paper",
    steps: [
      { goto: "/paper" },
      { click: { role: "button", name: "New" } },
      { click: { role: "button", name: "Cover letter" } },
      {
        click: {
          selector:
            '[data-slot="letter-start-blank"], [data-slot="paper-gallery-actions"] [data-variant="primary"]',
        },
      },
      { waitFor: { selector: PAGE } },
      { waitFor: DOWNLOAD_READY },
    ],
  },
  {
    id: "paper-letter-drafted",
    route: "/apply",
    steps: [
      ...ADD_A_JOB,
      { goto: "/paper" },
      { click: { role: "button", name: "New" } },
      { click: { role: "button", name: "Cover letter" } },
      {
        clickIfShown: {
          role: "button",
          name: "Draft with Coach",
        },
      },
      { click: { role: "button", name: "Product designer, Lumiere" } },
      { click: { role: "button", name: "Draft letter" } },
      { waitFor: { text: "Coach is writing" } },
      { click: { role: "button", name: "Stop" } },
      { waitFor: { selector: PAGE } },
    ],
  },
  {
    id: "paper-download-held",
    route: "/paper",
    unreachable:
      "Download Word is held only between a keystroke and its save; the page saves within a second and shot waits for the network to settle, so every capture shows the ready link",
  },
  {
    id: "paper-download-ready",
    route: "/paper",
    steps: [
      { goto: "/paper" },
      {
        upload: {
          selector: 'input[type="file"]',
          file: "cv-formatted.docx",
        },
      },
      { waitFor: { selector: PAGE } },
      { waitFor: DOWNLOAD_READY },
    ],
  },
]
