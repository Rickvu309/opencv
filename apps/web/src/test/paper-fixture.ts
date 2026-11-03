import { paperDocumentSchema } from "@workspace/domain"
import { openPaperClient, seedYDoc } from "@workspace/paper-crdt"

export type FixtureBlock = {
  id: string
  type: "paragraph" | "heading" | "bullet" | "numbered" | "divider"
  content?: { text: string; bold?: true }[]
  level?: 2 | 3
  children?: FixtureBlock[]
}

export const paragraph = (id: string, text: string): FixtureBlock => ({
  id,
  type: "paragraph",
  content: [{ text }],
})

export function seededCvClient(document: unknown) {
  const parsed = paperDocumentSchema.parse(document)
  const client = openPaperClient()
  client.receive(client.prepare(), {
    epoch: 1,
    revision: 1,
    reset: false,
    stale: false,
    update: seedYDoc(parsed),
    stateVector: new Uint8Array(),
  })
  return client
}

export function seededLetterClient(blocks: FixtureBlock[]) {
  const document = paperDocumentSchema.parse({
    version: 3,
    kind: "letter",
    blocks,
    clashes: [],
  })
  const client = openPaperClient()
  client.receive(client.prepare(), {
    epoch: 1,
    revision: 1,
    reset: false,
    stale: false,
    update: seedYDoc(document),
    stateVector: new Uint8Array(),
  })
  return client
}
