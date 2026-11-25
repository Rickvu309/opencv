export const screen = {
  id: "paper-rich-selection",
  route: "/paper",
  steps: [
    { respond: { fixture: "rich-document" } },
    {
      click: { selector: '.paper-rich-sheet [data-content-type="paragraph"]' },
    },
    { press: "Home" },
    { press: "Control+Shift+ArrowRight" },
  ],
}
