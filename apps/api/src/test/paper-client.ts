import type { PaperDocument } from "@workspace/domain"
import {
  openPaperClient,
  writeAsEditor,
  type ClientSyncReply,
  type PaperClient,
  type Prepared,
} from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"

import { paperDocs } from "../db/schema.js"
import { bytesOf, encoded } from "./paper-content.js"
import type { CoachStore } from "./paper-coach.js"

type Mutable = {
  id: string
  type: string
  content?: { text: string; bold?: boolean }[]
  children?: Mutable[]
}

export const p = (id: string, text: string): Mutable => ({
  id,
  type: "paragraph",
  content: [{ text }],
})

export const li = (
  id: string,
  text: string,
  children: Mutable[] = []
): Mutable => ({ id, type: "bullet", content: [{ text }], children })

export function letterOf(blocks: Mutable[]): PaperDocument {
  return { version: 3, kind: "letter", blocks, clashes: [] } as never
}

export function flat(blocks: readonly unknown[]): Mutable[] {
  return (blocks as Mutable[]).flatMap((block) => [
    block,
    ...flat(block.children ?? []),
  ])
}

export function textOf(doc: PaperDocument, id: string): string | null {
  const block = flat(doc.blocks).find((candidate) => candidate.id === id)
  return block?.content ? block.content.map((run) => run.text).join("") : null
}

export function wordsOf(doc: PaperDocument): string[] {
  return flat(doc.blocks).flatMap((block) =>
    (block.content ?? [])
      .map((run) => run.text)
      .join("")
      .split(/\s+/)
      .filter(Boolean)
  )
}

export function count(doc: PaperDocument, word: string) {
  return wordsOf(doc).filter((candidate) => candidate === word).length
}

export function order(doc: PaperDocument) {
  return (doc.blocks as unknown as Mutable[]).map((block) => block.id)
}

export function edited(
  doc: PaperDocument,
  id: string,
  change: (text: string) => string
): PaperDocument {
  const visit = (blocks: Mutable[]): Mutable[] =>
    blocks.map((block) => ({
      ...block,
      ...(block.id === id && block.content
        ? {
            content: [
              { text: change(block.content.map((r) => r.text).join("")) },
            ],
          }
        : {}),
      ...(block.children ? { children: visit(block.children) } : {}),
    }))
  return { ...doc, blocks: visit(doc.blocks as never) } as never
}

export function movedAfter(
  doc: PaperDocument,
  id: string,
  after: string | null
): PaperDocument {
  const blocks = [...(doc.blocks as unknown as Mutable[])]
  const from = blocks.findIndex((block) => block.id === id)
  const [node] = blocks.splice(from, 1)
  const at = after === null ? 0 : blocks.findIndex((b) => b.id === after) + 1
  blocks.splice(at, 0, node!)
  return { ...doc, blocks } as never
}

export function without(doc: PaperDocument, id: string): PaperDocument {
  const visit = (blocks: Mutable[]): Mutable[] =>
    blocks
      .filter((block) => block.id !== id)
      .map((block) =>
        block.children ? { ...block, children: visit(block.children) } : block
      )
  return { ...doc, blocks: visit(doc.blocks as never) } as never
}

export type Tab = ReturnType<typeof openTab>

export function openTab(
  h: CoachStore,
  docId: string,
  options: { gc?: boolean } = {}
) {
  const client: PaperClient = openPaperClient(null, options)
  let inFlight: { sent: Prepared; reply: ClientSyncReply } | null = null
  let failures = 0

  async function launch(forged?: Uint8Array, pullOnly = false) {
    const sent = client.prepare({ pullOnly })
    const out = await h.run("paper.sync", {
      docId,
      epoch: sent.epoch,
      update: encoded(sent.update),
      stateVector: encoded(forged ?? sent.stateVector),
      ...(sent.basedOn === undefined ? {} : { basedOn: sent.basedOn }),
    })
    const o = out.output as {
      epoch: number
      revision: number
      reset: boolean
      stale: boolean
      update: string
      stateVector: string
    }
    inFlight = {
      sent,
      reply: {
        epoch: o.epoch,
        revision: o.revision,
        reset: o.reset,
        stale: o.stale,
        update: bytesOf(o.update),
        stateVector: bytesOf(o.stateVector),
      },
    }
  }

  function deliver() {
    if (!inFlight) throw new Error("nothing in flight")
    const receipt = client.receive(inFlight.sent, inFlight.reply)
    inFlight = null
    if (receipt.failed) failures += 1
    return receipt
  }

  return {
    client,
    doc: () => {
      const doc = client.document()
      if (!doc) throw new Error("the tab holds no readable document")
      return doc
    },
    edit(change: (doc: PaperDocument) => PaperDocument) {
      const current = client.document()
      if (!current) throw new Error("the tab holds no readable document")
      writeAsEditor(client.ydoc, change(current), "person")
    },
    launch,
    deliver,
    async round(forged?: Uint8Array) {
      let receipt: ReturnType<typeof deliver> | null = null
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await launch(forged)
        receipt = deliver()
        if (!receipt.stale) break
      }
      return receipt!
    },
    async settle(rounds = 4) {
      for (let n = 0; n < rounds; n += 1) await this.round()
    },
    get failures() {
      return failures
    },
    get inFlight() {
      return inFlight !== null
    },
  }
}

export async function serverDoc(h: CoachStore, docId: string) {
  const rows = await h.store.db
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  const row = rows[0]!
  return {
    doc: row.crdtDocument as unknown as PaperDocument,
    revision: row.contentVersion,
  }
}

export async function newLetter(h: CoachStore, blocks: Mutable[]) {
  const made = await h.run("paper.create", { kind: "letter", name: "Letter" })
  const docId = (made.output as { id: string }).id
  const tab = openTab(h, docId)
  await tab.round()
  tab.edit(() => letterOf(blocks))
  await tab.settle(2)
  return { docId, tab }
}
