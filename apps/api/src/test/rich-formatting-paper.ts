import {
  richPaperDocumentSchema,
  safeHrefSchema,
  type RichPaperDocument,
} from "@workspace/domain"

export function richFormattingPaper(document: RichPaperDocument) {
  const section = document.flow.children[0]
  if (!section) throw new Error("Missing formatting section")
  const paragraph = (id: string, style: string) => ({
    id,
    type: "paragraph" as const,
    paragraph: { paragraphStyle: style },
    content: [{ text: `${id} Việt e\u0302 😀` }],
  })
  const list = (id: string, type: "bullet" | "numbered") => ({
    id,
    type,
    paragraph: {},
    content: [{ text: `${id} Việt` }],
    children: [
      {
        id: `${id}-nested`,
        type,
        paragraph: {},
        content: [{ text: `${id} nested` }],
        children: [],
      },
    ],
  })
  const children = [
    ...["normal", "title", "heading-1", "heading-2", "heading-3"].map((style) =>
      paragraph(style, style)
    ),
    list("bullets", "bullet"),
    list("numbers", "numbered"),
    {
      id: "links",
      type: "paragraph",
      paragraph: {},
      content: [
        {
          text: "Web ",
          href: safeHrefSchema.parse("https://example.com/career"),
        },
        {
          text: "HTTP ",
          href: safeHrefSchema.parse("http://example.com/work"),
        },
        {
          text: "Email",
          href: safeHrefSchema.parse("mailto:linh@example.com"),
        },
      ],
    },
    {
      id: "cleared",
      type: "paragraph",
      paragraph: { paragraphStyle: "normal" },
      content: [{ text: "Cleared formatting" }],
    },
  ]
  const parsed = richPaperDocumentSchema.parse({
    ...document,
    flow: {
      ...document.flow,
      children: document.flow.children.map((item) =>
        item === section
          ? { ...item, children: [...item.children, ...children] }
          : item
      ),
    },
  })
  document.flow = parsed.flow
}
