import { BlockNoteEditor } from "@blocknote/core"
import {
  _blocksToProsemirrorNode,
  yXmlFragmentToBlocks,
} from "@blocknote/core/yjs"
import { updateYFragment } from "y-prosemirror"
import * as Y from "yjs"
import {
  canonical,
  flowDocumentSchema,
  flowReceiptSchema,
  prepareFlowEdit,
  prepareFlowPhotoEdit,
  prepareFlowTableEdit,
  reverseFlowEdit,
  type FlowDocument,
} from "@workspace/domain/internal/paper-presentation"
import { attempt, formattingFragmentName } from "./native-formatting-shared.js"
import { object, string } from "./native-formatting-inline.js"
import {
  readPresentationMeta,
  writePresentationMeta,
} from "./presentation-meta.js"
import {
  headlessLayoutSchema as nativeLayoutSchema,
  type HeadlessLayoutEditor as PrivateLayoutEditor,
} from "./native-formatting-headless.js"
import { validateLayoutWire } from "./native-layout-wire.js"
import { flowBlocks, readFlowBlocks } from "./native-layout-flow-codec.js"

export type FlowBinding = Readonly<{
  doc: Y.Doc
  fragment: Y.XmlFragment
  engine: PrivateLayoutEditor
  kind: "cv" | "letter"
}>
const owned = new WeakSet<FlowBinding>()
function own(binding: FlowBinding) {
  owned.add(binding)
  return binding
}
function engine() {
  return BlockNoteEditor.create({ schema: nativeLayoutSchema })
}
function nodeOf(document: FlowDocument) {
  const binding = createFlow(document)
  try {
    return _blocksToProsemirrorNode(binding.engine, flowBlocks(document))
  } finally {
    binding.engine._tiptapEditor.destroy()
    binding.doc.destroy()
  }
}
function write(
  binding: FlowBinding,
  document: FlowDocument,
  node: ReturnType<typeof _blocksToProsemirrorNode>
) {
  updateYFragment(binding.doc, binding.fragment, node, {
    mapping: new Map(),
    isOMark: new Map(),
  })
  writePresentationMeta(binding.doc, document.presentation)
  const root = binding.doc.getMap<unknown>("paper")
  if (root.get("formattingProfile") !== document.profile)
    root.set("formattingProfile", document.profile)
}
export function readFlow(binding: FlowBinding): FlowDocument {
  if (!owned.has(binding)) throw new Error("Foreign flow binding")
  if (
    binding.doc.getMap<unknown>("paper").get("formattingProfile") !==
    "private-layout-3"
  )
    throw new Error("Wrong flow profile")
  validateLayoutWire(binding.fragment, binding.engine, "private-layout-3")
  const detached = new Y.Doc()
  try {
    const fragment = detached.getXmlFragment(
      formattingFragmentName(binding.kind)
    )
    fragment.insert(
      0,
      binding.fragment.toArray().map((child) => {
        if (!(child instanceof Y.XmlElement || child instanceof Y.XmlText))
          throw new Error("Unknown flow child")
        return child.clone()
      })
    )
    return readFlowBlocks(
      yXmlFragmentToBlocks(binding.engine, fragment),
      binding.kind,
      readPresentationMeta(binding.doc)
    )
  } finally {
    detached.destroy()
  }
}

export function writeCoachFlow(binding: FlowBinding, document: FlowDocument) {
  const validated = flowDocumentSchema.parse(document)
  if (validated.kind !== binding.kind) throw new Error("Document kind changed")
  const node = nodeOf(validated)
  const vector = Y.encodeStateVector(binding.doc)
  binding.doc.transact(() => write(binding, validated, node), "coach-rich")
  if (canonical(readFlow(binding)) !== canonical(validated))
    throw new Error("The Coach edit could not be applied exactly")
  return Y.encodeStateAsUpdate(binding.doc, vector)
}
function createFlow(document: FlowDocument): FlowBinding {
  const doc = new Y.Doc(),
    view = engine()
  const binding = own({
    doc,
    engine: view,
    fragment: doc.getXmlFragment(formattingFragmentName(document.kind)),
    kind: document.kind,
  })
  try {
    const node = _blocksToProsemirrorNode(view, flowBlocks(document))
    doc.transact(() => write(binding, document, node), "private-flow-create")
    if (canonical(readFlow(binding)) !== canonical(document))
      throw new Error("Engine changed flow semantics")
    return binding
  } catch (error) {
    view._tiptapEditor.destroy()
    doc.destroy()
    throw error
  }
}
export function createPrivateFlow(input: unknown) {
  return attempt(() => createFlow(flowDocumentSchema.parse(input)))
}
export function openFlowBinary(
  source: Uint8Array,
  kind: "cv" | "letter"
): FlowBinding {
  const doc = new Y.Doc(),
    view = engine()
  try {
    Y.applyUpdate(doc, source)
    const binding = own({
      doc,
      engine: view,
      fragment: doc.getXmlFragment(formattingFragmentName(kind)),
      kind,
    })
    readFlow(binding)
    return binding
  } catch (error) {
    view._tiptapEditor.destroy()
    doc.destroy()
    throw error
  }
}
export function borrowFlowDocument(doc: Y.Doc, kind: "cv" | "letter") {
  const view = engine()
  const binding = own({
    doc,
    engine: view,
    fragment: doc.getXmlFragment(formattingFragmentName(kind)),
    kind,
  })
  try {
    readFlow(binding)
    return {
      binding,
      release() {
        if (!owned.delete(binding)) return
        view._tiptapEditor.destroy()
      },
    }
  } catch (error) {
    owned.delete(binding)
    view._tiptapEditor.destroy()
    throw error
  }
}
function record(binding: FlowBinding, operationId: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(operationId))
    throw new Error("Invalid operation identity")
  const input = binding.doc
    .getMap<unknown>("paper")
    .get(`flow-receipt:${operationId}`)
  if (input === undefined) return null
  const entry = object(input, ["request", "receipt", "undone"])
  if (typeof entry.undone !== "boolean")
    throw new Error("Invalid flow reversal state")
  return {
    request: string(entry.request),
    receipt: flowReceiptSchema.parse(entry.receipt),
    undone: entry.undone,
  }
}
export function commitFlowEdit(
  binding: FlowBinding,
  operationId: string,
  edit: unknown,
  basis: string
) {
  return attempt(() => {
    const current = readFlow(binding),
      previous = record(binding, operationId),
      request = canonical({ edit, basis })
    if (previous) {
      if (previous.request !== request)
        throw new Error("Operation identity was reused")
      return previous.receipt
    }
    if (canonical(current) !== basis) throw new Error("Flow basis is stale")
    const prepared = prepareFlowEdit(current, edit)
    if (prepared.kind === "refused") throw new Error(prepared.reason)
    const node = nodeOf(prepared.value.document)
    binding.doc.transact(() => {
      write(binding, prepared.value.document, node)
      binding.doc.getMap<unknown>("paper").set(`flow-receipt:${operationId}`, {
        request,
        receipt: prepared.value.receipt,
        undone: false,
      })
    }, "private-flow-command")
    return prepared.value.receipt
  })
}
export function undoFlowEdit(
  binding: FlowBinding,
  operationId: string,
  basis: string
) {
  return attempt(() => {
    const current = readFlow(binding),
      previous = record(binding, operationId)
    if (!previous) throw new Error("Flow operation is missing")
    if (previous.undone) return current
    if (canonical(current) !== basis) throw new Error("Flow basis is stale")
    const prepared = reverseFlowEdit(current, previous.receipt)
    if (prepared.kind === "refused") throw new Error(prepared.reason)
    const node = nodeOf(prepared.value)
    binding.doc.transact(() => {
      write(binding, prepared.value, node)
      binding.doc
        .getMap<unknown>("paper")
        .set(`flow-receipt:${operationId}`, { ...previous, undone: true })
    }, "private-flow-undo")
    return prepared.value
  })
}

export function commitFlowPhotoEdit(
  binding: FlowBinding,
  edit: unknown,
  basis: string
) {
  return attempt(() => {
    const current = readFlow(binding)
    if (canonical(current) !== basis) throw new Error("Photo basis is stale")
    const prepared = prepareFlowPhotoEdit(current, edit)
    if (prepared.kind === "refused") throw new Error(prepared.reason)
    const node = nodeOf(prepared.value.document)
    binding.doc.transact(
      () => write(binding, prepared.value.document, node),
      "private-flow-photo"
    )
    return prepared.value.document
  })
}

export function commitFlowTableEdits(
  binding: FlowBinding,
  edits: readonly unknown[]
) {
  return attempt(() => {
    let document = readFlow(binding)
    for (const edit of edits) {
      const result = prepareFlowTableEdit(document, edit, crypto.randomUUID())
      if (result.kind === "refused") throw new Error(result.reason)
      document = result.value
    }
    const node = nodeOf(document)
    binding.doc.transact(
      () => write(binding, document, node),
      "private-flow-table"
    )
    return document
  })
}

export function commitFlowPageDocument(
  binding: FlowBinding,
  input: FlowDocument
) {
  return attempt(() => {
    const document = flowDocumentSchema.parse(input)
    const node = nodeOf(document)
    binding.doc.transact(
      () => write(binding, document, node),
      "private-flow-page"
    )
    return document
  })
}
