import { randomUUID } from "node:crypto"

import type { TestDatabase } from "../db/context.js"
import { files, paperPackageHeads, paperPackageVersions } from "../db/schema.js"

const WORD_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const NO_HASH = "0".repeat(64)

export async function insertWordPage(
  db: TestDatabase,
  input: {
    userId: string
    name: string
    kind: "cv" | "letter"
    bytes: Uint8Array
    canvasProfile?: string
  }
) {
  const fileId = randomUUID()
  const docId = randomUUID()
  const revision = randomUUID()
  const incarnation = randomUUID()
  await db.insert(files).values({
    id: fileId,
    userId: input.userId,
    name: `${input.name}.docx`,
    mediaType: WORD_MEDIA_TYPE,
    byteSize: input.bytes.byteLength,
    purpose: "package",
    bytes: Buffer.from(input.bytes),
  })
  await db.insert(paperPackageVersions).values({
    revision,
    parentRevision: null,
    docId,
    incarnation,
    userId: input.userId,
    requestId: randomUUID(),
    name: input.name,
    kind: input.kind,
    fileId,
    packageHash: NO_HASH,
    byteSize: input.bytes.byteLength,
    sidecar: {},
    sidecarHash: NO_HASH,
    projection: {},
    projectionHash: NO_HASH,
    projector: "stored-word-page",
    cursorKey: "stored-word-page",
  })
  await db.insert(paperPackageHeads).values({
    docId,
    userId: input.userId,
    incarnation,
    revision,
    canvasProfile: input.canvasProfile ?? null,
  })
  return { docId, revision }
}
