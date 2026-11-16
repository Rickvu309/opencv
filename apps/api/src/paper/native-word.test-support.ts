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
} from "@workspace/domain"
import { withDatabase, type TestDatabase } from "../db/context.js"
import { paperDocs } from "../db/schema.js"
import { richPaper } from "../test/rich-paper.js"
import type { RouteCase } from "../test/routes/route-cases.js"
import { seedColumns } from "./content-document.js"
import { saveFile } from "./store.js"

export const portraitBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAA2UlEQVR4nO3XsRECMQxE0auEXiiHDkioiUquCIq4/GICQJbWXjP+M5vrv1DbfX/99TZ7AQB3AQB3AQB3AQB3AQB3wYyA43n7tNkBX9I7MZSAYL3WIAM01QsNGkCiXmUAUKiXGAAAAAAAAACjoX4aQMEgucs/kDIIL/ITuwfAPQDvu1wfkc0ICKbLGQJAIl3IKAGK6RJGHiCsrxiSAHl92pABdKrPGZoBXesThjbAgPpWw0qAYfVNhihgcH3csAbAUh80LAAw1kcMAAD0BdjrfxoAAAAAAEAJcALUXzqp4/odPAAAAABJRU5ErkJggg==",
  "base64"
)

export async function savedRichWord(
  db: TestDatabase,
  userId: string,
  kind: "cv" | "letter"
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
    const qualified = richPaperDocumentSchema.parse(document)
    const id = randomUUID()
    await db.insert(paperDocs).values({
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

export const nativeWordRouteCase: RouteCase = {
  method: "GET",
  path: "/api/paper/:id/native-word",
  arrange: async (as) => {
    const saved = await as.command("paper.create", {
      kind: "cv",
      name: "Word route",
    })
    if (typeof saved.id !== "string") throw new Error("Missing Paper identity")
    const document = richPaper("cv", paperPhotoRef(randomUUID()))
    return {
      id: saved.id,
      basis: JSON.stringify({
        provenance: nativeProvenance(document),
        epoch: 1,
        revision: 0,
        digest: createHash("sha256")
          .update(canonicalPaper(document))
          .digest("hex"),
      }),
    }
  },
  request: (as, ids, signal) =>
    new Request(`http://localhost/api/paper/${ids.id}/native-word?kind=cv`, {
      headers: {
        Cookie: as.cookie,
        "x-paper-writer": JSON.stringify(RICH_NATIVE_WRITER),
        "x-paper-basis": ids.basis ?? "",
      },
      signal,
    }),
}
