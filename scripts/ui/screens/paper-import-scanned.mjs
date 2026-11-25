export const screen = {
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
}
