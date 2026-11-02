import { BlockNoteEditor } from "@blocknote/core"
import {
  _blocksToProsemirrorNode,
  yXmlFragmentToBlocks,
} from "@blocknote/core/yjs"
import type { PaperDocument } from "@workspace/domain"
import * as Y from "yjs"

import {
  fromEditorBlocks,
  toEditorBlocks,
  type PaperResult,
} from "./mapping.js"
import { FRAGMENT, META } from "./names.js"
import { groupOf, writeFragment } from "./reconcile.js"
import { paperSchema, type PaperEditor } from "./schema.js"
import { alignSkillItems } from "./skills.js"

let headless: PaperEditor | null = null

function editor() {
  headless ??= BlockNoteEditor.create({ schema: paperSchema })
  return headless
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
