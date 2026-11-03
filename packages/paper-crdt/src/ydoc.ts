import { BlockNoteEditor } from "@blocknote/core"
import {
  _blocksToProsemirrorNode,
  yXmlFragmentToBlocks,
} from "@blocknote/core/yjs"
import type { PaperDocument } from "@workspace/domain"
import * as Y from "yjs"

import {
  candidateOf,
  fromEditorBlocks,
  toEditorBlocks,
  type PaperResult,
} from "./mapping.js"
import { FRAGMENT, META } from "./names.js"
import { repairBlocks } from "./blocks-repair.js"
import { groupOf, writeFragment } from "./reconcile.js"
import { paperSchema, type PaperEditor } from "./schema.js"
import { alignSkillItems } from "./skills.js"

let headless: PaperEditor | null = null

function editor() {
  headless ??= BlockNoteEditor.create({ schema: paperSchema })
  return headless
}

export function headlessEditor() {
  return editor()
}

function kindOf(yDoc: Y.Doc): PaperDocument["kind"] | null {
  const kind = yDoc.getMap<string>(META).get("kind")
  return kind === "cv" || kind === "letter" ? kind : null
}

function diffInto(
  yDoc: Y.Doc,
  target: PaperDocument,
  origin: string,
  moved: ReadonlySet<string>
): void {
  const blocks = toEditorBlocks(target)
  const fragment = yDoc.getXmlFragment(FRAGMENT)
  const root = fragment.length === 1 ? groupOf(fragment) : null
  if (root) alignSkillItems(root, blocks)
  const node = _blocksToProsemirrorNode(editor(), blocks)
  yDoc.transact(() => writeFragment(yDoc, fragment, node, moved), origin)
}

export function seedYDoc(document: PaperDocument): Uint8Array {
  if (document.clashes.length > 0) {
    throw new Error("A paper with open clashes cannot be seeded")
  }
  const yDoc = new Y.Doc()
  yDoc.getMap<string>(META).set("kind", document.kind)
  diffInto(yDoc, document, "seed", new Set())
  return Y.encodeStateAsUpdate(yDoc)
}

export function materialize(source: Uint8Array | Y.Doc): PaperResult {
  let yDoc = source
  if (source instanceof Uint8Array) {
    yDoc = new Y.Doc()
    Y.applyUpdate(yDoc, source)
  }
  const doc = yDoc as Y.Doc
  const kind = kindOf(doc)
  if (!kind) return { ok: false, reason: "The document has no kind" }
  const fragment = doc.getXmlFragment(FRAGMENT)
  if (fragment.length !== 1) {
    return {
      ok: false,
      reason: `The document holds ${fragment.length} roots, not one`,
    }
  }
  return fromEditorBlocks(kind, yXmlFragmentToBlocks(editor(), fragment))
}

export function writeDocument(
  yDoc: Y.Doc,
  target: PaperDocument,
  origin: string,
  moved: ReadonlySet<string> = new Set()
): Uint8Array | null {
  if (kindOf(yDoc) !== target.kind) {
    throw new Error("The target is not the kind of paper this document holds")
  }
  const updates: Uint8Array[] = []
  const collect = (update: Uint8Array) => updates.push(update)
  yDoc.on("update", collect)
  try {
    diffInto(yDoc, target, origin, moved)
  } finally {
    yDoc.off("update", collect)
  }
  return updates[0] ?? null
}

export type Candidate =
  | {
      readonly ok: true
      readonly candidate: unknown
      readonly repaired: boolean
    }
  | { readonly ok: false; readonly reason: string }

export function materializeCandidate(yDoc: Y.Doc): Candidate {
  const kind = kindOf(yDoc)
  if (!kind) return { ok: false, reason: "The document has no kind" }
  const fragment = yDoc.getXmlFragment(FRAGMENT)
  if (fragment.length !== 1) {
    return {
      ok: false,
      reason: `The document holds ${fragment.length} roots, not one`,
    }
  }
  const read = yXmlFragmentToBlocks(editor(), fragment)
  const fixed = repairBlocks(kind, read as never)
  try {
    return {
      ok: true,
      candidate: candidateOf(kind, fixed.blocks as never),
      repaired: fixed.repaired,
    }
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error ? error.message : "Cannot read the document",
    }
  }
}

type Container = { element: Y.XmlElement; id: string }

function aliveContainers(yDoc: Y.Doc, only?: ReadonlySet<string>): Container[] {
  const found: Container[] = []
  const visit = (node: Y.XmlFragment | Y.XmlElement) => {
    for (const child of node.toArray()) {
      if (!(child instanceof Y.XmlElement)) continue
      const id = child.getAttribute("id")
      if (typeof id === "string" && (!only || only.has(id))) {
        found.push({ element: child, id })
      }
      visit(child)
    }
  }
  visit(yDoc.getXmlFragment(FRAGMENT))
  return found
}

export function twinFlags(
  yDoc: Y.Doc,
  update: Uint8Array
): Map<string, boolean[]> {
  const incoming = Y.decodeUpdate(update).structs as unknown as {
    id: { client: number; clock: number }
    length: number
  }[]
  const fromUpdate = (item: Y.Item) =>
    incoming.some(
      (struct) =>
        struct.id.client === item.id.client &&
        item.id.clock >= struct.id.clock &&
        item.id.clock < struct.id.clock + struct.length
    )
  const byId = new Map<string, boolean[]>()
  for (const { element, id } of aliveContainers(yDoc)) {
    const flags = byId.get(id) ?? []
    flags.push(element._item ? fromUpdate(element._item) : false)
    byId.set(id, flags)
  }
  return new Map([...byId].filter(([, flags]) => flags.length > 1))
}

export function writeRepair(
  yDoc: Y.Doc,
  target: PaperDocument,
  origin: string,
  moved: ReadonlySet<string>,
  keep: ReadonlyMap<string, number>
): Uint8Array | null {
  const updates: Uint8Array[] = []
  const collect = (update: Uint8Array) => updates.push(update)
  yDoc.on("update", collect)
  try {
    yDoc.transact(() => {
      const twins = aliveContainers(yDoc, new Set(keep.keys()))
      for (const [id, index] of keep) {
        const same = twins.filter((twin) => twin.id === id)
        same.forEach(({ element }, at) => {
          if (at === index) return
          const parent = element.parent as Y.XmlFragment | Y.XmlElement
          parent.delete(parent.toArray().indexOf(element), 1)
        })
      }
    }, origin)
    diffInto(yDoc, target, origin, moved)
  } finally {
    yDoc.off("update", collect)
  }
  if (updates.length === 0) return null
  return updates.length === 1 ? updates[0]! : Y.mergeUpdates(updates)
}
