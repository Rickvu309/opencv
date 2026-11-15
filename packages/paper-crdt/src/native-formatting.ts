import { BlockNoteEditor } from "@blocknote/core"
import {
  _blocksToProsemirrorNode,
  yXmlFragmentToBlocks,
} from "@blocknote/core/yjs"
import { updateYFragment } from "y-prosemirror"
import * as Y from "yjs"
import {
  formattedDocumentSchema,
  canonical,
  type Result,
  type PrivateFormattedDocument,
} from "@workspace/domain/internal/paper-presentation"
import {
  nativeFormattingSchema,
  type PrivateFormattingEditor,
} from "./native-formatting-schema.js"
import {
  fromFormattingBlocks,
  toFormattingBlocks,
} from "./native-formatting-cv.js"
import {
  assertFormattingBinding,
  ownFormattingBinding,
  type EngineBinding,
} from "./presentation-binding.js"
import {
  readPresentationMeta,
  writePresentationMeta,
  FORMATTING_PROFILE,
} from "./presentation-meta.js"
import {
  validateFormattingEngine,
  validateFormattingWire,
} from "./native-formatting-wire.js"
import { attempt, formattingFragmentName } from "./native-formatting-shared.js"
export { attempt, formattingFragmentName } from "./native-formatting-shared.js"
export function readFormatting(
  binding: EngineBinding
): PrivateFormattedDocument {
  assertFormattingBinding(binding)
  const profile = binding.doc.getMap<unknown>("paper").get("formattingProfile")
  if (profile !== FORMATTING_PROFILE)
    throw new Error("Wrong formatting profile")
  validateFormattingWire(binding.fragment, binding.engine)
  const presentation = readPresentationMeta(binding.doc)
  const detached = new Y.Doc()
  try {
    const fragment = detached.getXmlFragment(
      formattingFragmentName(binding.kind)
    )
    fragment.insert(
      0,
      binding.fragment.toArray().map((child) => {
        if (!(child instanceof Y.XmlElement || child instanceof Y.XmlText))
          throw new Error("Unknown wire child")
        return child.clone()
      })
    )
    return fromFormattingBlocks(
      yXmlFragmentToBlocks(binding.engine, fragment),
      binding.kind,
      presentation
    )
  } finally {
    detached.destroy()
  }
}
export const readPrivateFormatting = (binding: EngineBinding) =>
  attempt(() => readFormatting(binding))
export function admittedNode(document: PrivateFormattedDocument) {
  const checked = formattedDocumentSchema.parse(document)
  const engine = BlockNoteEditor.create({ schema: nativeFormattingSchema })
  const detached = new Y.Doc()
  try {
    const node = _blocksToProsemirrorNode(engine, toFormattingBlocks(checked))
    const fragment = detached.getXmlFragment(
      formattingFragmentName(checked.kind)
    )
    updateYFragment(detached, fragment, node, {
      mapping: new Map(),
      isOMark: new Map(),
    })
    writePresentationMeta(detached, checked.presentation)
    detached
      .getMap<unknown>("paper")
      .set("formattingProfile", FORMATTING_PROFILE)
    const binding = ownFormattingBinding({
      doc: detached,
      fragment,
      engine,
      kind: checked.kind,
    })
    if (canonical(readFormatting(binding)) !== canonical(checked))
      throw new Error("Engine changes formatting semantics")
    return node
  } finally {
    detached.destroy()
    engine._tiptapEditor.destroy()
  }
}
export function createPrivateFormatting(input: unknown): Result<EngineBinding> {
  return attempt(() => {
    const document = formattedDocumentSchema.parse(input)
    const node = admittedNode(document)
    const doc = new Y.Doc()
    const binding = ownFormattingBinding({
      doc,
      fragment: doc.getXmlFragment(formattingFragmentName(document.kind)),
      kind: document.kind,
      engine: BlockNoteEditor.create({ schema: nativeFormattingSchema }),
    })
    doc.transact(() => {
      updateYFragment(doc, binding.fragment, node, {
        mapping: new Map(),
        isOMark: new Map(),
      })
      writePresentationMeta(doc, document.presentation)
      doc.getMap<unknown>("paper").set("formattingProfile", FORMATTING_PROFILE)
    }, "private-formatting-create")
    return binding
  })
}
export function openFormattedBinary(
  source: Uint8Array,
  kind: "cv" | "letter"
): EngineBinding {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, source)
    const binding = ownFormattingBinding({
      doc,
      fragment: doc.getXmlFragment(formattingFragmentName(kind)),
      engine: BlockNoteEditor.create({ schema: nativeFormattingSchema }),
      kind,
    })
    readFormatting(binding)
    return binding
  } catch (error) {
    doc.destroy()
    throw error
  }
}
export function writePrivateFormatting(
  binding: EngineBinding,
  input: unknown,
  origin: string
): Result<void> {
  return attempt(() => {
    readFormatting(binding)
    const document = formattedDocumentSchema.parse(input)
    if (document.kind !== binding.kind) throw new Error("Wrong document kind")
    const node = admittedNode(document)
    binding.doc.transact(() => {
      updateYFragment(binding.doc, binding.fragment, node, {
        mapping: new Map(),
        isOMark: new Map(),
      })
      writePresentationMeta(binding.doc, document.presentation)
    }, origin)
  })
}
export function writePrivateFormattingBlocks(
  binding: EngineBinding,
  blocks: unknown,
  origin: string
): Result<void> {
  return attempt(() => {
    const before = readFormatting(binding)
    const candidate = fromFormattingBlocks(
      blocks,
      binding.kind,
      before.presentation
    )
    const result = writePrivateFormatting(binding, candidate, origin)
    if (result.kind === "refused") throw new Error(result.reason)
  })
}
export function writePrivateFormattingEngine(
  binding: EngineBinding,
  engine: PrivateFormattingEditor,
  origin: string
): Result<void> {
  return attempt(() => {
    readFormatting(binding)
    validateFormattingEngine(engine)
    const result = writePrivateFormattingBlocks(
      binding,
      engine.document,
      origin
    )
    if (result.kind === "refused") throw new Error(result.reason)
  })
}
