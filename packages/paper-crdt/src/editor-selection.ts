import type { EditorView } from "@tiptap/pm/view"
import { TextSelection } from "@tiptap/pm/state"
import type { RelativePosition } from "yjs"
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
  type ProsemirrorBinding,
} from "y-prosemirror"

type Selection = {
  anchor: RelativePosition
  head: RelativePosition
  focused: boolean
}

function binding(view: EditorView) {
  const sync: { binding: ProsemirrorBinding } | undefined =
    ySyncPluginKey.getState(view.state)
  return sync?.binding
}

export function captureEditorSelection(
  view: EditorView
): Selection | undefined {
  const current = binding(view)
  if (!current || !(view.state.selection instanceof TextSelection)) return
  return {
    anchor: absolutePositionToRelativePosition(
      view.state.selection.anchor,
      current.type,
      current.mapping
    ),
    head: absolutePositionToRelativePosition(
      view.state.selection.head,
      current.type,
      current.mapping
    ),
    focused: view.hasFocus(),
  }
}

export function restoreEditorSelection(view: EditorView, selection: Selection) {
  const current = binding(view)
  if (!current) return
  const anchor = relativePositionToAbsolutePosition(
    current.doc,
    current.type,
    selection.anchor,
    current.mapping
  )
  const head = relativePositionToAbsolutePosition(
    current.doc,
    current.type,
    selection.head,
    current.mapping
  )
  if (
    anchor === null ||
    head === null ||
    !view.state.doc.resolve(anchor).parent.inlineContent ||
    !view.state.doc.resolve(head).parent.inlineContent
  )
    return
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, anchor, head)
    )
  )
  if (selection.focused) view.focus()
}
