import { personActor } from "@workspace/domain/kernel"
import { paperEngineBlank, type Document } from "@workspace/domain/paper-doc"
import { and, asc, eq, isNull } from "drizzle-orm"

import { getDb, transaction } from "../db/context.js"
import {
  files,
  paperDocs,
  paperPackageHeads,
  paperPackageVersions,
} from "../db/schema.js"
import { paperFromWord } from "./import/word-to-paper.js"
import { createPaper } from "./store.js"
import { readDocx } from "./word/read-docx.js"

async function enginePageFromWord(
  bytes: Uint8Array,
  kind: "cv" | "letter"
): Promise<Document | null> {
  const read = await readDocx(Buffer.from(bytes)).catch(() => null)
  if (!read) return null
  const blank = paperEngineBlank.emptyPaper(kind)
  const content = read.document.content.filter(
    (block) => block.type !== "image"
  )
  return {
    ...blank,
    attrs: { ...blank.attrs, page: read.document.attrs.page },
    content: content.length ? content : blank.content,
  }
}

export async function convertWordPages() {
  const pages = await getDb()
    .select({
      docId: paperPackageHeads.docId,
      userId: paperPackageHeads.userId,
      createdAt: paperPackageHeads.createdAt,
      name: paperPackageVersions.name,
      kind: paperPackageVersions.kind,
      bytes: files.bytes,
    })
    .from(paperPackageHeads)
    .innerJoin(
      paperPackageVersions,
      and(
        eq(paperPackageVersions.docId, paperPackageHeads.docId),
        eq(paperPackageVersions.revision, paperPackageHeads.revision)
      )
    )
    .innerJoin(files, eq(files.id, paperPackageVersions.fileId))
    .leftJoin(paperDocs, eq(paperDocs.id, paperPackageHeads.docId))
    .where(isNull(paperDocs.id))
    .orderBy(asc(paperPackageHeads.createdAt))
  const converted: string[] = []
  const unreadable: string[] = []
  for (const page of pages) {
    const word = await paperFromWord(page.bytes, page.kind).catch(() => null)
    const enginePage = await enginePageFromWord(page.bytes, page.kind)
    if (!word || !enginePage) {
      unreadable.push(page.docId)
      continue
    }
    await transaction(() =>
      createPaper(personActor(page.userId), {
        kind: page.kind,
        name: page.name,
        paper: word.paper,
        page: enginePage,
        id: page.docId,
        createdAt: page.createdAt,
      })
    )
    converted.push(page.docId)
  }
  return { converted, unreadable }
}
