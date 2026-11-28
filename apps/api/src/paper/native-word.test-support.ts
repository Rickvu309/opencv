import { createHash, randomUUID } from "node:crypto"
import { parseUserId } from "@workspace/domain/kernel"
import {
  canonicalPaper,
  nativeProvenance,
  paperPhotoRef,
  RICH_NATIVE_WRITER,
  richPaperDocumentSchema,
  type SafeHref,
  type NativeBasis,
  type RichPaperDocument,
} from "@workspace/domain/paper-doc"
import { withDatabase, type TestDatabase } from "../db/context.js"
import { insertPaperFixture } from "../test/paper-row.js"
import { richPaper } from "../test/rich-paper.js"
import { seedColumns } from "./content/content-document.js"
import { saveFile } from "./store.js"

const safeHref = (href: string) => href as SafeHref

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
            href: safeHref("https://example.com/career"),
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
