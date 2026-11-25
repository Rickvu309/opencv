import { PAGE } from "../screen-steps.mjs"

export const screen = {
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
}
