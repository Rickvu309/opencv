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
  plain: { anchor: number; head: number }
  relative?: { anchor: RelativePosition; head: RelativePosition }
  focused: boolean
}

function binding(view: EditorView) {
  const sync: { binding: ProsemirrorBinding } | undefined =
    ySyncPluginKey.getState(view.state)
  return sync?.binding
}

export function captureEditorSelection(view: EditorView): Selection {
  const current = binding(view)
  const { anchor, head } = view.state.selection
  return {
    plain: { anchor, head },
    relative:
      current && view.state.selection instanceof TextSelection
        ? {
            anchor: absolutePositionToRelativePosition(
              anchor,
              current.type,
              current.mapping
            ),
            head: absolutePositionToRelativePosition(
              head,
              current.type,
              current.mapping
            ),
          }
        : undefined,
    focused: view.hasFocus(),
  }
}

export function restoreEditorSelection(view: EditorView, selection: Selection) {
  const current = binding(view)
  const resolve = (relative: RelativePosition | undefined, plain: number) => {
    const position =
      current && relative
        ? relativePositionToAbsolutePosition(
            current.doc,
            current.type,
            relative,
            current.mapping
          )
        : null
    return view.state.doc.resolve(
      Math.max(0, Math.min(position ?? plain, view.state.doc.content.size))
    )
  }
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.between(
        resolve(selection.relative?.anchor, selection.plain.anchor),
        resolve(selection.relative?.head, selection.plain.head)
      )
    )
  )
  if (selection.focused) view.focus()
}
