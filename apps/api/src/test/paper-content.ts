import {
  personActor,
  type CvBlockDocument,
  type PaperDocument,
} from "@workspace/domain"
import {
  loadYDoc,
  materialize,
  writeDocument,
  type PaperYDoc,
} from "@workspace/paper-crdt"

import { user } from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "./harness.js"

export async function openStore(userId: string) {
  const { db, client } = await createMigratedTestDb()
  await db
    .insert(user)
    .values({ id: userId, name: "Ada", email: `${userId}@example.com` })
  return { db, client, registry: installRegistry(), actor: personActor(userId) }
}

export const twoParagraphCv: CvBlockDocument = {
  version: 2,
  header: { name: "Ada", email: "", phone: "", city: "", linkedin: "" },
  sections: [
    {
      id: "s1",
      kind: "summary",
      blocks: [
        { id: "t1", type: "text", text: "First paragraph." },
        { id: "t2", type: "text", text: "Second paragraph." },
      ],
    },
  ],
}

export function bytesOf(encoded: string) {
  return new Uint8Array(Buffer.from(encoded, "base64"))
}

export function encoded(bytes: Uint8Array | null) {
  return Buffer.from(bytes ?? new Uint8Array()).toString("base64")
}

export function clientFrom(fullState: string): PaperYDoc {
  return loadYDoc(bytesOf(fullState), [])
}

export function typed(
  client: PaperYDoc,
  change: (paper: PaperDocument) => PaperDocument
) {
  const current = materialize(client)
  if (!current.ok) throw new Error(current.reason)
  return encoded(writeDocument(client, change(current.document), "person"))
}

export function withText(paper: PaperDocument, id: string, text: string) {
  return {
    ...paper,
    blocks: paper.blocks.map((block) =>
      block.id === id && "content" in block
        ? { ...block, content: [{ text }] }
        : block
    ),
  } as PaperDocument
}
