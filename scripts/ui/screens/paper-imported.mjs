import { PAGE } from "../screen-steps.mjs"

export const screen = {
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
}
