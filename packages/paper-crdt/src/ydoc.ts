import { BlockNoteEditor } from "@blocknote/core"
import {
  _blocksToProsemirrorNode,
  yXmlFragmentToBlocks,
} from "@blocknote/core/yjs"
import { paperDocumentSchema, type PaperDocument } from "@workspace/domain"
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
import { nativePaperSchema, paperSchema } from "./schema.js"
import { alignSkillItems } from "./skills.js"

let legacyHeadless: ReturnType<typeof createHeadless> | null = null
let nativeHeadless: ReturnType<typeof createHeadless> | null = null

function createHeadless(version: 3 | 4) {
  return BlockNoteEditor.create({
    schema: version === 3 ? paperSchema : nativePaperSchema,
  })
}

function editor(version: 3 | 4) {
  if (version === 3) {
    legacyHeadless ??= createHeadless(version)
    return legacyHeadless
  }
  nativeHeadless ??= createHeadless(version)
  return nativeHeadless
}

export function headlessEditor(version: 3 | 4 = 3) {
  return editor(version)
}

function kindOf(yDoc: Y.Doc): PaperDocument["kind"] | null {
  const kind = yDoc.getMap<string>(META).get("kind")
  return kind === "cv" || kind === "letter" ? kind : null
}

export function documentVersionOf(yDoc: Y.Doc): 3 | 4 | null {
  const meta = yDoc.getMap<string>(META)
  const version = meta.get("version")
  if (version === undefined || version === "3")
    return meta.has("schemaRevision") ? null : 3
  return version === "4" && meta.get("schemaRevision") === "1" ? 4 : null
}

export function admitWriteTarget(yDoc: Y.Doc, target: unknown): PaperDocument {
  const parsed = paperDocumentSchema.parse(target)
  if (
    kindOf(yDoc) !== parsed.kind ||
    documentVersionOf(yDoc) !== parsed.version
  )
    throw new Error("The target belongs to a different document schema")
  return parsed
}

function diffInto(
  yDoc: Y.Doc,
  target: PaperDocument,
  origin: string,
  moved: ReadonlySet<string>
): void {
  target = paperDocumentSchema.parse(target)
  const blocks = toEditorBlocks(target)
  const fragment = yDoc.getXmlFragment(FRAGMENT)
  const root = fragment.length === 1 ? groupOf(fragment) : null
  if (root) alignSkillItems(root, blocks)
  const node = _blocksToProsemirrorNode(editor(target.version), blocks)
  yDoc.transact(() => writeFragment(yDoc, fragment, node, moved), origin)
}

export function seedYDoc(document: PaperDocument): Uint8Array {
  document = paperDocumentSchema.parse(document)
  if (document.clashes.length > 0) {
    throw new Error("A paper with open clashes cannot be seeded")
  }
  const yDoc = new Y.Doc()
  yDoc.getMap<string>(META).set("kind", document.kind)
  yDoc.getMap<string>(META).set("version", String(document.version))
  if (document.version === 4)
    yDoc
      .getMap<string>(META)
      .set("schemaRevision", String(document.schemaRevision))
  diffInto(yDoc, document, "seed", new Set())
  return Y.encodeStateAsUpdate(yDoc)
}

function nativeStructureRefusal(fragment: Y.XmlFragment): string | null {
  const schema = editor(4).pmSchema
  const marks = new Set(["bold", "italic", "underline", "link"])
  const nodes = new Set([
    "blockGroup",
    "blockContainer",
    "paragraph",
    "heading",
    "bulletListItem",
    "numberedListItem",
    "divider",
    "paperHeader",
    "paperSection",
    "paperExperience",
    "paperEducation",
    "paperSkills",
    "paperSkillItem",
    "hardBreak",
  ])
  const visit = (parent: Y.XmlFragment | Y.XmlElement): string | null => {
    const children = parent.toArray()
    const name = parent instanceof Y.XmlElement ? parent.nodeName : "root"
    if (
      name === "root" &&
      (children.length !== 1 ||
        !(children[0] instanceof Y.XmlElement) ||
        children[0].nodeName !== "blockGroup")
    )
      return "Unsupported native structure"
    if (
      name === "blockGroup" &&
      children.some(
        (child) =>
          !(child instanceof Y.XmlElement) ||
          child.nodeName !== "blockContainer"
      )
    )
      return "Unsupported native structure"
    if (
      name === "blockContainer" &&
      (children.length < 1 ||
        children.length > 2 ||
        children.some(
          (child, index) =>
            !(child instanceof Y.XmlElement) ||
            (index === 0
              ? ["blockGroup", "blockContainer", "hardBreak"].includes(
                  child.nodeName
                )
              : child.nodeName !== "blockGroup")
        ))
    )
      return "Unsupported native structure"
    if (
      [
        "paperHeader",
        "paperExperience",
        "paperEducation",
        "paperSkills",
        "divider",
        "hardBreak",
      ].includes(name) &&
      children.length > 0
    )
      return "Unsupported native structure"
    if (name === "blockContainer" && children.length === 2) {
      const content = children[0]
      if (
        !(content instanceof Y.XmlElement) ||
        ![
          "paperExperience",
          "paperEducation",
          "paperSkills",
          "bulletListItem",
          "numberedListItem",
        ].includes(content.nodeName)
      )
        return "Unsupported native structure"
    }
    if (
      !["root", "blockGroup", "blockContainer"].includes(name) &&
      children.some(
        (child) =>
          !(child instanceof Y.XmlText) &&
          (!(child instanceof Y.XmlElement) || child.nodeName !== "hardBreak")
      )
    )
      return "Unsupported native structure"
    for (const child of children) {
      if (child instanceof Y.XmlText) {
        for (const delta of child.toDelta() as {
          insert?: unknown
          attributes?: Record<string, unknown>
        }[]) {
          if (typeof delta.insert !== "string")
            return "Unsupported native inline content"
          if (
            ["paperSection", "paperSkillItem"].includes(name) &&
            Object.keys(delta.attributes ?? {}).length > 0
          )
            return "Unsupported native text mark"
          for (const [name, attrs] of Object.entries(delta.attributes ?? {})) {
            const mark = schema.marks[name]
            if (
              !marks.has(name) ||
              !mark ||
              !attrs ||
              typeof attrs !== "object" ||
              Array.isArray(attrs)
            )
              return "Unsupported native text mark"
            const allowed = mark.spec.attrs ?? {}
            if (
              Object.entries(attrs).some(
                ([key, value]) =>
                  !(key in allowed) ||
                  (key !== "href" && value !== allowed[key].default)
              )
            )
              return "Unsupported native mark attribute"
          }
        }
      } else if (child instanceof Y.XmlElement) {
        const node = schema.nodes[child.nodeName]
        if (!nodes.has(child.nodeName) || !node)
          return "Unsupported native node"
        const allowed = node.spec.attrs ?? {}
        if (Object.keys(child.getAttributes()).some((key) => !(key in allowed)))
          return "Unsupported native node attribute"
        if (
          child.nodeName.startsWith("paper") &&
          Object.entries(child.getAttributes()).some(
            ([key, value]) => typeof value !== typeof allowed[key]?.default
          )
        )
          return "Unsupported native node attribute value"
        const carried = new Set([
          ...(child.nodeName === "blockContainer" ? ["id"] : []),
          ...(child.nodeName === "heading" ? ["level"] : []),
          ...(child.nodeName.startsWith("paper") ? Object.keys(allowed) : []),
        ])
        if (
          Object.entries(child.getAttributes()).some(
            ([key, value]) =>
              !carried.has(key) && value !== allowed[key]?.default
          )
        )
          return "Unsupported native node attribute value"
        const failure = visit(child)
        if (failure) return failure
      } else return "Unsupported native structure"
    }
    return null
  }
  return visit(fragment)
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
  const version = documentVersionOf(doc)
  if (version === null)
    return { ok: false, reason: "Unsupported document schema" }
  const unsupported = version === 4 ? nativeStructureRefusal(fragment) : null
  if (unsupported) return { ok: false, reason: unsupported }
  return fromEditorBlocks(
    kind,
    yXmlFragmentToBlocks(editor(version), fragment),
    version
  )
}

export function writeDocument(
  yDoc: Y.Doc,
  target: PaperDocument,
  origin: string,
  moved: ReadonlySet<string> = new Set()
): Uint8Array | null {
  target = admitWriteTarget(yDoc, target)
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
  const version = documentVersionOf(yDoc)
  if (version === null)
    return { ok: false, reason: "Unsupported document schema" }
  const unsupported = version === 4 ? nativeStructureRefusal(fragment) : null
  if (unsupported) return { ok: false, reason: unsupported }
  const read = yXmlFragmentToBlocks(editor(version), fragment)
  const fixed = repairBlocks(kind, read as never)
  try {
    return {
      ok: true,
      candidate: candidateOf(kind, fixed.blocks as never, version),
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
  target = admitWriteTarget(yDoc, target)
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
