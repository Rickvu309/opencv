import {
  canonicalPaper,
  sameNativeProvenance,
  type NativeProvenance,
  type StoredPaperDocument,
  type RichPaperDocument,
  richPaperDocumentSchema,
  nativeProvenanceSchema,
  RICH_NATIVE_WRITER,
} from "@workspace/domain"
import * as Y from "yjs"
import { materializeStored } from "./stored-document.js"
import {
  preservePendingContent,
  restorePendingContent,
} from "./pending-content.js"

export const REBASE_ORIGIN = "paper-rebase"
export const SERVER_ORIGIN = "paper-server"

export type SyncReply = {
  readonly provenance?: NativeProvenance
  readonly epoch: number
  readonly revision: number
  readonly reset: boolean
  readonly stale: boolean
  readonly update: Uint8Array
  readonly stateVector: Uint8Array
}

export type Prepared = {
  readonly provenance?: NativeProvenance
  readonly basedOn?: number
  readonly epoch: number
  readonly update: Uint8Array
  readonly stateVector: Uint8Array
}

export type Stored = {
  readonly provenance?: NativeProvenance
  readonly epoch: number
  readonly server: Uint8Array
  readonly pending: Uint8Array
  readonly revision?: number
}

export type Receipt = {
  readonly reset: boolean
  readonly stale: boolean
  readonly rebased: boolean
  readonly failed: boolean
}

export type Adoption = {
  readonly adopted: boolean
  readonly failed: boolean
}

export type ClientChange = "local" | "remote" | "reset"

export type PaperClient<
  Document extends StoredPaperDocument = RichPaperDocument,
> = {
  readonly ydoc: Y.Doc
  readonly provenance?: NativeProvenance
  readonly epoch: number
  readonly revision: number
  readonly rebuilds: number
  hasPending(): boolean
  prepare(options?: { readonly pullOnly?: boolean }): Prepared
  adopt(orphan: Stored): Adoption
  receive(sent: Prepared, reply: SyncReply): Receipt
  stored(): Stored
  state(): Uint8Array
  document(): Document | null
  subscribe(listener: (change: ClientChange) => void): () => void
  onDocumentRelease(listener: () => void): () => void
  destroy(): void
}

function freshDoc(
  gc: boolean,
  ...updates: (Uint8Array | null | undefined)[]
): Y.Doc {
  const doc = new Y.Doc({ gc })
  try {
    for (const update of updates) if (update) Y.applyUpdate(doc, update)
    return doc
  } catch (error) {
    doc.destroy()
    throw error
  }
}

function stateOf(doc: Y.Doc) {
  return {
    vector: Y.decodeStateVector(Y.encodeStateVector(doc)),
    deletes: Y.createDeleteSetFromStructStore(doc.store),
  }
}

function sameState(
  a: ReturnType<typeof stateOf>,
  b: ReturnType<typeof stateOf>
) {
  if (a.vector.size !== b.vector.size) return false
  for (const [client, clock] of a.vector) {
    if (b.vector.get(client) !== clock) return false
  }
  return Y.equalDeleteSets(a.deletes, b.deletes)
}

function aheadOf(ydoc: Y.Doc, server: Y.Doc): boolean {
  const mine = Y.decodeStateVector(Y.encodeStateVector(ydoc))
  const known = Y.decodeStateVector(Y.encodeStateVector(server))
  for (const [client, clock] of mine) {
    if (clock > (known.get(client) ?? 0)) return true
  }
  const sent = Y.createDeleteSetFromStructStore(server.store)
  const deleted = Y.createDeleteSetFromStructStore(ydoc.store)
  for (const [client, ranges] of deleted.clients) {
    for (const range of ranges) {
      for (let at = range.clock; at < range.clock + range.len; at += 1) {
        if (!Y.isDeleted(sent, Y.createID(client, at))) return true
      }
    }
  }
  return false
}

export function storedHasPending(stored: Stored): boolean {
  const live = freshDoc(false, stored.server, stored.pending)
  const server = freshDoc(false, stored.server)
  try {
    return aheadOf(live, server)
  } finally {
    live.destroy()
    server.destroy()
  }
}

function same(a: StoredPaperDocument | null, b: StoredPaperDocument | null) {
  return a !== null && b !== null && canonicalPaper(a) === canonicalPaper(b)
}

type DocumentAdapter<Document extends StoredPaperDocument> = {
  read(doc: Y.Doc): Document | null
  write(doc: Y.Doc, document: Document, origin: string): unknown
  rebase(input: { base: Document; ours: Document; theirs: Document }): {
    document: Document
    failed: boolean
  }
  readonly semanticRebase: boolean
}

const richAdapter: DocumentAdapter<RichPaperDocument> = {
  read(doc) {
    const result = materializeStored(doc)
    if (!result.ok) return null
    const parsed = richPaperDocumentSchema.safeParse(result.document)
    return parsed.success ? parsed.data : null
  },
  write() {
    throw new Error(
      "Rich recovery cannot rebuild a document from a second text store"
    )
  },
  rebase() {
    throw new Error(
      "Rich recovery needs its original Yjs basis. Recovery bytes were retained."
    )
  },
  semanticRebase: false,
}

class Client<
  Document extends StoredPaperDocument,
> implements PaperClient<Document> {
  ydoc: Y.Doc
  epoch: number
  revision: number
  rebuilds = 0
  readonly provenance?: NativeProvenance
  private server: Y.Doc
  private readonly gc: boolean
  private readonly adapter: DocumentAdapter<Document>
  private listeners = new Set<(change: ClientChange) => void>()
  private releases = new Set<() => void>()
  private destroyed = false
  private detach: () => void = () => {}

  constructor(
    stored: Stored | null,
    gc: boolean,
    provenance: NativeProvenance | undefined,
    adapter: DocumentAdapter<Document>
  ) {
    this.adapter = adapter
    if (stored && !sameNativeProvenance(stored.provenance, provenance))
      throw new Error(
        "The local document belongs to a different schema. Its recovery bytes were retained."
      )
    this.provenance = provenance
    this.gc = gc
    this.epoch = stored?.epoch ?? 0
    this.revision = stored?.revision ?? 0
    this.server = freshDoc(gc, stored?.server)
    this.ydoc = freshDoc(gc, stored?.server, stored?.pending)
    if (stored) {
      const document = this.adapter.read(this.ydoc)
      if (
        provenance
          ? !document ||
            document.version !== provenance.documentVersion ||
            document.schemaRevision !== provenance.schemaRevision
          : document?.version === 4
      )
        throw new Error(
          "Local recovery bytes do not match their schema identity. They were retained."
        )
    }
    this.attach()
  }

  private attach() {
    const doc = this.ydoc
    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      this.announce(
        origin === REBASE_ORIGIN || origin === SERVER_ORIGIN
          ? "remote"
          : "local"
      )
    }
    doc.on("update", onUpdate)
    this.detach = () => doc.off("update", onUpdate)
  }

  private announce(change: ClientChange) {
    for (const listener of [...this.listeners]) listener(change)
  }

  subscribe(listener: (change: ClientChange) => void) {
    this.requireActive()
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  onDocumentRelease(listener: () => void) {
    this.requireActive()
    this.releases.add(listener)
    return () => {
      this.releases.delete(listener)
    }
  }

  private requireActive() {
    if (this.destroyed) throw new Error("Paper client is closed")
  }

  private releaseDocument() {
    for (const release of [...this.releases]) release()
    this.releases.clear()
    this.detach()
    this.ydoc.destroy()
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.releaseDocument()
    this.server.destroy()
    this.listeners.clear()
  }

  private pendingBytes() {
    return Y.encodeStateAsUpdate(this.ydoc, Y.encodeStateVector(this.server))
  }

  hasPending() {
    this.requireActive()
    return aheadOf(this.ydoc, this.server)
  }

  prepare(options: { readonly pullOnly?: boolean } = {}): Prepared {
    this.requireActive()
    const push = options.pullOnly !== true && this.hasPending()
    return {
      ...(this.provenance ? { provenance: this.provenance } : {}),
      epoch: this.epoch,
      update: push ? this.pendingBytes() : Y.encodeStateAsUpdate(new Y.Doc()),
      stateVector: Y.encodeStateVector(this.server),
      ...(push ? { basedOn: this.revision } : {}),
    }
  }

  stored(): Stored {
    this.requireActive()
    return {
      ...(this.provenance ? { provenance: this.provenance } : {}),
      epoch: this.epoch,
      server: Y.encodeStateAsUpdate(this.server),
      pending: this.pendingBytes(),
      revision: this.revision,
    }
  }

  state() {
    this.requireActive()
    return Y.encodeStateAsUpdate(this.ydoc)
  }

  document() {
    this.requireActive()
    return this.adapter.read(this.ydoc)
  }

  private applyHere(doc: Y.Doc, update: Uint8Array) {
    try {
      Y.applyUpdate(doc, update, SERVER_ORIGIN)
    } catch {
      return
    }
  }

  private settle(target: Document) {
    if (same(this.adapter.read(this.ydoc), target)) return
    this.adapter.write(this.ydoc, target, REBASE_ORIGIN)
    if (same(this.adapter.read(this.ydoc), target)) return
    const rebuilt = freshDoc(this.gc, Y.encodeStateAsUpdate(this.server))
    this.adapter.write(rebuilt, target, REBASE_ORIGIN)
    this.rebuilds += 1
    this.releaseDocument()
    this.ydoc = rebuilt
    this.attach()
    this.announce("reset")
  }

  receive(sent: Prepared, reply: SyncReply): Receipt {
    this.requireActive()
    const rejected = {
      reset: false,
      stale: false,
      rebased: false,
      failed: true,
    }
    if (
      !sameNativeProvenance(this.provenance, reply.provenance) ||
      !sameNativeProvenance(this.provenance, sent.provenance) ||
      !Number.isSafeInteger(reply.epoch) ||
      reply.epoch < 1 ||
      !Number.isSafeInteger(reply.revision) ||
      reply.revision < 0 ||
      sent.epoch !== this.epoch ||
      (!reply.reset && this.epoch !== 0 && reply.epoch !== this.epoch) ||
      reply.epoch < this.epoch ||
      reply.revision < this.revision
    )
      return rejected
    let candidate: Y.Doc | undefined
    let restorations: ReturnType<typeof preservePendingContent> = []
    try {
      candidate = reply.reset
        ? freshDoc(false, reply.update)
        : freshDoc(
            false,
            Y.encodeStateAsUpdate(this.server),
            reply.stale ? null : sent.update,
            reply.update
          )
      const document = this.adapter.read(candidate)
      const current = this.adapter.read(this.ydoc)
      if (!this.adapter.semanticRebase) {
        if (reply.reset && this.hasPending()) return rejected
        if (!reply.reset) {
          const merged = freshDoc(
            false,
            Y.encodeStateAsUpdate(this.ydoc),
            reply.update
          )
          try {
            restorations = preservePendingContent(
              this.ydoc,
              this.server,
              merged
            )
            restorePendingContent(merged, restorations)
            if (!this.adapter.read(merged)) return rejected
          } finally {
            merged.destroy()
          }
        }
      }
      if (current && document && current.kind !== document.kind) return rejected
      if (
        this.provenance
          ? !document ||
            document.version !== this.provenance.documentVersion ||
            document.schemaRevision !== this.provenance.schemaRevision
          : document?.version === 4
      )
        return rejected
    } catch {
      return rejected
    } finally {
      candidate?.destroy()
    }
    this.revision = reply.revision
    if (reply.reset) return this.resetTo(reply)
    this.epoch = reply.epoch
    const plain = {
      reset: false,
      stale: reply.stale,
      rebased: false,
      failed: false,
    }
    if (!reply.stale) this.applyHere(this.server, sent.update)
    const settled = this.adapter.read(this.server)
    const pendingBeforeReply = this.hasPending()
    const before = stateOf(this.server)
    this.applyHere(this.server, reply.update)
    const theirs = this.adapter.read(this.server)
    const ours = this.adapter.read(this.ydoc)
    const foreign =
      settled !== null &&
      theirs !== null &&
      !sameState(before, stateOf(this.server))
    if (
      !this.adapter.semanticRebase ||
      !foreign ||
      !pendingBeforeReply ||
      ours === null
    ) {
      this.applyHere(this.ydoc, reply.update)
      restorePendingContent(this.ydoc, restorations)
      return { ...plain, failed: theirs === null && settled !== null }
    }
    let target: { readonly document: Document; readonly failed: boolean }
    try {
      target = this.adapter.rebase({ base: settled, ours, theirs })
    } catch {
      this.applyHere(this.ydoc, reply.update)
      return { ...plain, failed: true }
    }
    this.applyHere(this.ydoc, reply.update)
    this.settle(target.document)
    return { ...plain, rebased: true, failed: target.failed }
  }

  adopt(orphan: Stored): Adoption {
    this.requireActive()
    if (!sameNativeProvenance(this.provenance, orphan.provenance))
      return { adopted: false, failed: true }
    if (!this.adapter.semanticRebase) return { adopted: false, failed: true }
    const base = this.adapter.read(freshDoc(false, orphan.server))
    const ours = this.adapter.read(
      freshDoc(false, orphan.server, orphan.pending)
    )
    const lead = this.adapter.read(this.ydoc)
    if (!base || !ours || !lead) return { adopted: false, failed: false }
    if (
      [base, ours].some(
        (document) =>
          document.kind !== lead.kind ||
          document.version !== lead.version ||
          (document.version === 4 &&
            (lead.version !== 4 ||
              document.schemaRevision !== lead.schemaRevision))
      )
    )
      return { adopted: false, failed: true }
    if (same(base, ours)) return { adopted: true, failed: false }
    try {
      const merged = this.adapter.rebase({ base, ours, theirs: lead })
      this.settle(merged.document)
      return { adopted: true, failed: merged.failed }
    } catch {
      return { adopted: false, failed: true }
    }
  }

  private resetTo(reply: SyncReply): Receipt {
    const base = this.adapter.read(this.server)
    const ours = this.adapter.read(this.ydoc)
    const changed = base !== null && ours !== null && !same(base, ours)
    const server = freshDoc(this.gc, reply.update)
    const ydoc = freshDoc(this.gc, reply.update)
    const theirs = this.adapter.read(server)
    const merged =
      changed && base && ours && theirs
        ? this.adapter.rebase({ base, ours, theirs })
        : null
    if (merged) this.adapter.write(ydoc, merged.document, REBASE_ORIGIN)
    this.releaseDocument()
    this.server.destroy()
    this.server = server
    this.ydoc = ydoc
    this.epoch = reply.epoch
    this.attach()
    this.announce("reset")
    return {
      reset: true,
      stale: false,
      rebased: changed,
      failed: merged?.failed ?? false,
    }
  }
}

export function openRichPaperClient(
  stored: Stored | null,
  options: { readonly gc?: boolean; readonly provenance: NativeProvenance }
): PaperClient<RichPaperDocument> {
  const provenance = nativeProvenanceSchema.parse(options.provenance)
  if (
    provenance.schemaRevision !== 2 ||
    !RICH_NATIVE_WRITER.supportedSchemaRevisions.includes(
      provenance.schemaRevision
    ) ||
    provenance.requiredCapabilities.some(
      (capability) => !RICH_NATIVE_WRITER.capabilities.includes(capability)
    )
  )
    throw new Error("Rich document provenance required")
  return new Client(stored, options.gc ?? false, provenance, richAdapter)
}
