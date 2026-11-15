import { BlockNoteEditor } from "@blocknote/core"
import {
  _blocksToProsemirrorNode,
  yXmlFragmentToBlocks,
} from "@blocknote/core/yjs"
import { updateYFragment } from "y-prosemirror"
import * as Y from "yjs"
import {
  canonical,
  privateLayoutSchema,
  prepareLayoutEdit,
  reverseLayoutEdit,
  layoutReceiptSchema,
  type PrivateLayoutDocument,
  type LayoutReceipt,
} from "@workspace/domain/internal/paper-presentation"
import { attempt, formattingFragmentName } from "./native-formatting.js"
import { object, string } from "./native-formatting-inline.js"
import {
  readPresentationMeta,
  writePresentationMeta,
} from "./presentation-meta.js"
import {
  nativeLayoutSchema,
  type PrivateLayoutEditor,
} from "./native-layout-schema.js"
import { fromLayoutBlocks, toLayoutBlocks } from "./native-layout-codec.js"
import { validateLayoutWire } from "./native-layout-wire.js"

export type LayoutBinding = Readonly<{
  doc: Y.Doc
  fragment: Y.XmlFragment
  engine: PrivateLayoutEditor
  kind: "cv" | "letter"
}>
const owned = new WeakSet<LayoutBinding>()
function own(binding: LayoutBinding): LayoutBinding {
  owned.add(binding)
  return binding
}
export function readLayout(binding: LayoutBinding): PrivateLayoutDocument {
  if (!owned.has(binding)) throw new Error("Foreign layout binding")
  if (
    binding.doc.getMap<unknown>("paper").get("formattingProfile") !==
    "private-layout-1"
  )
    throw new Error("Wrong layout profile")
  validateLayoutWire(binding.fragment, binding.engine)
  const detached = new Y.Doc()
  try {
    const fragment = detached.getXmlFragment(
      formattingFragmentName(binding.kind)
    )
    fragment.insert(
      0,
      binding.fragment.toArray().map((child) => {
        if (!(child instanceof Y.XmlElement || child instanceof Y.XmlText))
          throw new Error("Unknown layout child")
        return child.clone()
      })
    )
    return fromLayoutBlocks(
      yXmlFragmentToBlocks(binding.engine, fragment),
      binding.kind,
      readPresentationMeta(binding.doc)
    )
  } finally {
    detached.destroy()
  }
}
function admittedNode(input: PrivateLayoutDocument) {
  const document = privateLayoutSchema.parse(input)
  const engine = BlockNoteEditor.create({ schema: nativeLayoutSchema })
  const doc = new Y.Doc()
  try {
    const node = _blocksToProsemirrorNode(engine, toLayoutBlocks(document))
    const fragment = doc.getXmlFragment(formattingFragmentName(document.kind))
    updateYFragment(doc, fragment, node, {
      mapping: new Map(),
      isOMark: new Map(),
    })
    writePresentationMeta(doc, document.presentation)
    doc.getMap<unknown>("paper").set("formattingProfile", "private-layout-1")
    if (
      canonical(
        readLayout(own({ doc, fragment, engine, kind: document.kind }))
      ) !== canonical(document)
    )
      throw new Error("Engine changes layout semantics")
    return node
  } finally {
    doc.destroy()
    engine._tiptapEditor.destroy()
  }
}
export function createPrivateLayout(input: unknown) {
  return attempt(() => {
    const document = privateLayoutSchema.parse(input),
      node = admittedNode(document)
    const doc = new Y.Doc(),
      engine = BlockNoteEditor.create({ schema: nativeLayoutSchema })
    const binding = own({
      doc,
      engine,
      kind: document.kind,
      fragment: doc.getXmlFragment(formattingFragmentName(document.kind)),
    })
    doc.transact(() => {
      updateYFragment(doc, binding.fragment, node, {
        mapping: new Map(),
        isOMark: new Map(),
      })
      writePresentationMeta(doc, document.presentation)
      doc.getMap<unknown>("paper").set("formattingProfile", "private-layout-1")
    }, "private-layout-create")
    return binding
  })
}
export function openLayoutBinary(
  source: Uint8Array,
  kind: "cv" | "letter"
): LayoutBinding {
  const doc = new Y.Doc(),
    engine = BlockNoteEditor.create({ schema: nativeLayoutSchema })
  try {
    Y.applyUpdate(doc, source)
    const binding = own({
      doc,
      engine,
      kind,
      fragment: doc.getXmlFragment(formattingFragmentName(kind)),
    })
    readLayout(binding)
    return binding
  } catch (error) {
    doc.destroy()
    engine._tiptapEditor.destroy()
    throw error
  }
}
function record(binding: LayoutBinding, operationId: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(operationId))
    throw new Error("Invalid operation identity")
  const input = binding.doc
    .getMap<unknown>("paper")
    .get(`layout-receipt:${operationId}`)
  if (input === undefined) return null
  const entry = object(input, ["request", "receipt", "undone"])
  if (typeof entry.undone !== "boolean")
    throw new Error("Invalid reversal state")
  return {
    request: string(entry.request),
    receipt: layoutReceiptSchema.parse(entry.receipt),
    undone: entry.undone,
  }
}
export function commitLayoutEdit(
  binding: LayoutBinding,
  operationId: string,
  edit: unknown,
  basis: string
) {
  return attempt(() => {
    const current = readLayout(binding),
      previous = record(binding, operationId)
    const request = canonical({ edit, basis })
    if (previous) {
      if (previous.request !== request)
        throw new Error("Operation identity was reused")
      return previous.receipt
    }
    if (canonical(current) !== basis) throw new Error("Layout basis is stale")
    const prepared = prepareLayoutEdit(current, edit)
    if (prepared.kind === "refused") throw new Error(prepared.reason)
    const node = admittedNode(prepared.value.document)
    binding.doc.transact(() => {
      updateYFragment(binding.doc, binding.fragment, node, {
        mapping: new Map(),
        isOMark: new Map(),
      })
      binding.doc
        .getMap<unknown>("paper")
        .set(`layout-receipt:${operationId}`, {
          request,
          receipt: prepared.value.receipt,
          undone: false,
        })
    }, "private-layout-edit")
    return prepared.value.receipt
  })
}
export function undoLayoutEdit(
  binding: LayoutBinding,
  operationId: string,
  basis: string
) {
  return attempt(() => {
    const current = readLayout(binding),
      previous = record(binding, operationId)
    if (!previous) throw new Error("Missing durable layout receipt")
    if (previous.undone) return
    if (canonical(current) !== basis) throw new Error("Layout basis is stale")
    const reversed = reverseLayoutEdit(current, previous.receipt)
    if (reversed.kind === "refused") throw new Error(reversed.reason)
    const node = admittedNode(reversed.value)
    binding.doc.transact(() => {
      updateYFragment(binding.doc, binding.fragment, node, {
        mapping: new Map(),
        isOMark: new Map(),
      })
      binding.doc
        .getMap<unknown>("paper")
        .set(`layout-receipt:${operationId}`, { ...previous, undone: true })
    }, "private-layout-undo")
  })
}
export function readLayoutReceipt(
  binding: LayoutBinding,
  operationId: string
): LayoutReceipt | null {
  readLayout(binding)
  return record(binding, operationId)?.receipt ?? null
}
