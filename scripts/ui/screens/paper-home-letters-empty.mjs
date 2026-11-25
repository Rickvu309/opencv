export const screen = {
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
}
