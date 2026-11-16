import { createHash, randomUUID } from "node:crypto"
import {
  canonicalPaper,
  nativeProvenance,
  paperPhotoRef,
  parseUserId,
  RICH_NATIVE_WRITER,
  richPaperDocumentSchema,
  safeHrefSchema,
  type NativeBasis,
  type RichPaperDocument,
} from "@workspace/domain"
import { withDatabase, type TestDatabase } from "../db/context.js"
import { insertPaperFixture } from "../test/paper-row.js"
import { richPaper } from "../test/rich-paper.js"
import { seedColumns } from "./content-document.js"
import { saveFile } from "./store.js"

export const portraitBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAA2UlEQVR4nO3XsRECMQxE0auEXiiHDkioiUquCIq4/GICQJbWXjP+M5vrv1DbfX/99TZ7AQB3AQB3AQB3AQB3AQB3wYyA43n7tNkBX9I7MZSAYL3WIAM01QsNGkCiXmUAUKiXGAAAAAAAAACjoX4aQMEgucs/kDIIL/ITuwfAPQDvu1wfkc0ICKbLGQJAIl3IKAGK6RJGHiCsrxiSAHl92pABdKrPGZoBXesThjbAgPpWw0qAYfVNhihgcH3csAbAUh80LAAw1kcMAAD0BdjrfxoAAAAAAEAJcALUXzqp4/odPAAAAABJRU5ErkJggg==",
  "base64"
)

export async function savedRichWord(
  db: TestDatabase,
  userId: string,
  kind: "cv" | "letter",
  prepare?: (document: RichPaperDocument) => void
) {
  return withDatabase(db, async () => {
    const photo = await saveFile({
      userId: parseUserId(userId),
      name: "Portrait.png",
      mediaType: "image/png",
      bytes: portraitBytes,
      purpose: "avatar",
    })
    const document = richPaper(kind, paperPhotoRef(photo.id))
    for (const section of document.flow.children) {
      for (const node of section.children) {
        if (node.type === "header") node.photo = paperPhotoRef(photo.id)
        if (node.type === "paragraph")
          node.content.push({
            text: " Link",
            href: safeHrefSchema.parse("https://example.com/career"),
            underline: true,
          })
      }
    }
    prepare?.(document)
    const qualified = richPaperDocumentSchema.parse(document)
    const id = randomUUID()
    await insertPaperFixture(db, {
      id,
      userId,
      name: `Linh Việt ${kind}`,
      kind,
      contentVersion: 0,
      crdtBaseSeq: 0,
      ...seedColumns(kind, qualified),
    })
    const basis: NativeBasis = {
      provenance: nativeProvenance(qualified),
      epoch: 1,
      revision: 0,
      digest: createHash("sha256")
        .update(canonicalPaper(qualified))
        .digest("hex"),
    }
    return {
      id,
      document: qualified,
      photo,
      basis,
      input: { docId: id, kind, writer: RICH_NATIVE_WRITER, basis },
    }
  })
}

export function wordHeaders(cookie: string, basis: NativeBasis) {
  return {
    Cookie: cookie,
    "x-paper-writer": JSON.stringify(RICH_NATIVE_WRITER),
    "x-paper-basis": JSON.stringify(basis),
  }
}

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
