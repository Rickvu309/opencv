export const screen = {
  id: "paper-home-search-miss",
  route: "/paper",
  steps: [
    { paperDocs: { count: 2 } },
    { goto: "/paper" },
    { waitFor: { text: "Company 2" } },
    { fill: { role: "searchbox", name: "Search Paper", text: "zzz" } },
    { waitFor: { text: "Nothing matches" } },
  ],
}
