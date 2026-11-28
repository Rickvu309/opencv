import * as Y from "yjs"
import { cvSlots, richPaperDocumentSchema } from "@workspace/domain/paper-doc"

export function paperPhotoRef(fileId: string) {
  return `file:${fileId}`
}

export function richPaper(kind: "cv" | "letter", photo: string) {
  const page = {
    width: 11906,
    height: 16838,
    orientation: "portrait",
    top: 1440,
    bottom: 1440,
    start: 1440,
    end: 1440,
  }
  const paragraph = (id: string) => ({
    id,
    type: "paragraph",
    paragraph: { alignment: "center", before: 120 },
    content: [
      {
        text: "Việt e\u0302 😀",
        bold: true,
        underline: false,
        fontId: "liberation-serif",
        size: 260,
      },
    ],
  })
  return richPaperDocumentSchema.parse({
    version: 4,
    schemaRevision: 2,
    profile: "private-layout-3",
    kind,
    presentation: {
      codecVersion: 1,
      page,
      inline: {},
      paragraph: {},
      styles: [],
    },
    flow: {
      id: "flow",
      type: "flow",
      children: [
        {
          id: "section-1",
          type: "flowSection",
          start: "continuous",
          page,
          columns: { count: 1, gap: 360 },
          children: [
            ...(kind === "cv"
              ? [
                  {
                    id: "header",
                    type: "header",
                    children: cvSlots.header.map((fieldKey) => ({
                      id: `header-${fieldKey}`,
                      type: "cvField",
                      ownerId: "header",
                      fieldKey,
                      paragraph: {},
                      content:
                        fieldKey === "name"
                          ? [{ text: "Linh", italic: true }]
                          : [],
                    })),
                  },
                ]
              : []),
            paragraph("intro"),
            {
              id: "table",
              type: "table",
              columns: [{ id: "column", width: 5000 }],
              children: [
                {
                  id: "row",
                  type: "row",
                  children: [
                    {
                      id: "cell",
                      type: "cell",
                      columnId: "column",
                      children: [
                        paragraph("cell-text"),
                        {
                          id: "photo",
                          type: "photo",
                          source: photo,
                          width: 1200,
                          height: 1600,
                          crop: { top: 0, right: 0, bottom: 0, left: 0 },
                          rotation: 0,
                          shape: "rounded",
                          placement: { kind: "block", alignment: "center" },
                          spacing: { top: 0, right: 0, bottom: 0, left: 0 },
                          alt: "Portrait",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            { id: "page-break", type: "pageBreak" },
            paragraph("after"),
          ],
        },
      ],
    },
  })
}

export function richElement(parent: Y.XmlFragment, id: string): Y.XmlElement {
  for (const child of parent.toArray()) {
    if (!(child instanceof Y.XmlElement)) continue
    if (child.getAttribute("id") === id) return child
    try {
      return richElement(child, id)
    } catch {
      continue
    }
  }
  throw new Error(`Missing ${id}`)
}
export function richText(parent: Y.XmlFragment): Y.XmlText {
  for (const child of parent.toArray()) {
    if (child instanceof Y.XmlText && child.length) return child
    if (child instanceof Y.XmlElement) {
      try {
        return richText(child)
      } catch {
        continue
      }
    }
  }
  throw new Error("Missing text")
}
export function richFragment(doc: Y.Doc) {
  return doc.getXmlFragment(
    doc.getMap("paper").get("kind") === "cv"
      ? "private-native-cv-v4-r2"
      : "document-store"
  )
}
