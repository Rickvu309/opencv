import { DOWNLOAD_READY, PAGE } from "../screen-steps.mjs"

export const screen = {
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
    ...DOWNLOAD_READY,
  ],
}
