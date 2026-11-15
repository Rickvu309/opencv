import { privateLayoutSchema } from "@workspace/domain/internal/paper-presentation"

export const layoutParagraph = (id: string, text = "Việt e\u0302 😀") => ({
  id,
  type: "paragraph",
  paragraph: { alignment: "right" },
  content: [
    { text, bold: false, italic: true, fontId: "liberation-sans", size: 240 },
  ],
})
export const layoutRow = (id: string) => ({
  id,
  type: "row",
  children: ["a", "b"].map((columnId) => ({
    id: `${id}-${columnId}`,
    type: "cell",
    columnId,
    children: [layoutParagraph(`${id}-${columnId}-p`)],
  })),
})
export function layoutFixture() {
  return privateLayoutSchema.parse({
    profile: "private-layout-1",
    kind: "letter",
    presentation: {
      codecVersion: 1,
      page: {
        width: 11906,
        height: 16838,
        orientation: "portrait",
        top: 1440,
        bottom: 1440,
        start: 1440,
        end: 1440,
      },
      inline: { fontId: "liberation-serif", bold: true },
      paragraph: {},
      styles: [],
    },
    flow: {
      id: "flow",
      type: "flow",
      children: [
        layoutParagraph("intro"),
        {
          id: "table",
          type: "table",
          columns: [
            { id: "a", width: 3000 },
            { id: "b", width: 5000 },
          ],
          children: [layoutRow("r1"), layoutRow("r2")],
        },
        layoutParagraph("after"),
      ],
    },
  })
}
