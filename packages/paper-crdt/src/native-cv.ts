import { BlockNoteEditor } from "@blocknote/core"
import {
  _blocksToProsemirrorNode,
  yXmlFragmentToBlocks,
} from "@blocknote/core/yjs"
import {
  nativeCvDocumentSchema,
  type NativeCvDocument,
} from "@workspace/domain"
import { updateYFragment } from "y-prosemirror"
import * as Y from "yjs"

import { fromNativeCvBlocks, toNativeCvBlocks } from "./native-cv-mapping.js"
import { nativeCvSchema, type NativeCvEditor } from "./native-cv-schema.js"
import { validateNativeCvWire } from "./native-cv-wire.js"
import { writeFragment } from "./reconcile.js"

const FRAGMENT = "private-native-cv-v4-r2"
const owned = new WeakMap<Y.Doc, NativeCvEditor>()

function editor(): NativeCvEditor {
  return BlockNoteEditor.create({ schema: nativeCvSchema })
}

export function openNativeCvDocument(source?: Uint8Array): Y.Doc {
  const doc = new Y.Doc()
  const engine = editor()
  try {
    if (source) {
      Y.applyUpdate(doc, source)
      read(doc, engine)
    }
    owned.set(doc, engine)
    return doc
  } catch (error) {
    doc.destroy()
    throw error
  }
}

function read(doc: Y.Doc, engine: NativeCvEditor): NativeCvDocument {
  const fragment = doc.getXmlFragment(FRAGMENT)
  if (fragment.length !== 1)
    throw new Error("Private CV must contain one engine root")
  validateNativeCvWire(fragment, engine)
  return fromNativeCvBlocks(yXmlFragmentToBlocks(engine, fragment))
}

export function materializeNativeCv(
  source: Y.Doc | Uint8Array
): NativeCvDocument {
  if (source instanceof Uint8Array) {
    const doc = openNativeCvDocument(source)
    try {
      return materializeNativeCv(doc)
    } finally {
      doc.destroy()
    }
  }
  const engine = owned.get(source)
  if (!engine) throw new Error("Y.Doc is not owned by private CV codec")
  return read(source, engine)
}

function admit(document: NativeCvDocument) {
  const checked = nativeCvDocumentSchema.parse(document)
  const engine = editor()
  const blocks = toNativeCvBlocks(checked)
  const node = _blocksToProsemirrorNode(engine, blocks)
  const detached = new Y.Doc()
  try {
    writeFragment(detached, detached.getXmlFragment(FRAGMENT), node, new Set())
    if (JSON.stringify(read(detached, engine)) !== JSON.stringify(checked))
      throw new Error("Engine changes private CV semantics")
    return { blocks, node }
  } finally {
    detached.destroy()
  }
}

export function writeNativeCvDocument(
  doc: Y.Doc,
  target: NativeCvDocument,
  origin: string,
  moved: ReadonlySet<string> = new Set()
): void {
  const candidate = admit(target)
  if (!owned.has(doc)) throw new Error("Y.Doc is not owned by private CV codec")
  doc.transact(
    () =>
      writeFragment(doc, doc.getXmlFragment(FRAGMENT), candidate.node, moved),
    origin
  )
}

export function writeNativeCvBlocks(
  doc: Y.Doc,
  blocks: unknown,
  origin: string
): void {
  const candidate = admit(fromNativeCvBlocks(blocks))
  const engine = owned.get(doc)
  if (!engine) throw new Error("Y.Doc is not owned by private CV codec")
  const node = _blocksToProsemirrorNode(engine, candidate.blocks)
  doc.transact(
    () =>
      updateYFragment(doc, doc.getXmlFragment(FRAGMENT), node as never, {
        mapping: new Map(),
        isOMark: new Map(),
      }),
    origin
  )
}
