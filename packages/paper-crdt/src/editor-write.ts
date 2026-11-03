import { _blocksToProsemirrorNode } from "@blocknote/core/yjs"
import type { PaperDocument } from "@workspace/domain"
import { updateYFragment } from "y-prosemirror"
import * as Y from "yjs"

import { toEditorBlocks } from "./mapping.js"
import { FRAGMENT } from "./names.js"
import { headlessEditor } from "./ydoc.js"

type Binding = {
  mapping: Map<unknown, unknown>
  isOMark: Map<unknown, unknown>
}

const bindings = new WeakMap<Y.Doc, Binding>()

export function writeAsEditor(
  yDoc: Y.Doc,
  target: PaperDocument,
  origin: string
): void {
  const node = _blocksToProsemirrorNode(
    headlessEditor(),
    toEditorBlocks(target)
  )
  const binding = bindings.get(yDoc) ?? {
    mapping: new Map(),
    isOMark: new Map(),
  }
  bindings.set(yDoc, binding)
  yDoc.transact(
    () =>
      updateYFragment(
        yDoc,
        yDoc.getXmlFragment(FRAGMENT),
        node as never,
        binding as never
      ),
    origin
  )
}
