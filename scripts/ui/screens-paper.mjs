import {
  ADD_A_JOB,
  DOWNLOAD_READY,
  HARD_NAMES,
  OPEN_BLANK_CV,
  OPEN_NEW_CV,
  OPEN_PANEL,
  PAGE,
  SAVED,
} from "./screen-steps.mjs"

export const PAPER_SCREENS = [
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
