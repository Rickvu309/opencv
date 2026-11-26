export const screen = {
  id: "paper-home-written",
  route: "/paper",
  steps: [
    {
      paperDocs: {
        count: 3,
        names: ["Product Designer CV", "Letter to Northwind", "Research CV"],
        lines: [
          "Ada Lovelace",
          "Product designer who ships calm, careful tools.",
          "Experience",
          "Northwind, Senior Designer, 2022 to now",
          "Led the redesign of the booking flow.",
          "Education",
          "Hanoi University of Science and Technology",
        ],
      },
    },
    { goto: "/paper" },
    { waitFor: { text: "Product Designer CV" } },
  ],
}
