import { useCallback, useEffect, useRef } from "react"
import { TextSelection } from "prosemirror-state"
import type { LetterEditor } from "./paper-editor-engine.tsx"

type Place = { blockId: string; offset: number }

export function useEditorResume(editor: LetterEditor) {
  const place = useRef<Place | null>(null)
  const focused = useRef(false)
  const placed = useRef(false)
  useEffect(() => {
    const at = place.current
    placed.current = false
    if (!focused.current) return
    editor.focus()
    if (!at || !editor.getBlock(at.blockId)) return
    editor.setTextCursorPosition(at.blockId, "start")
    editor.transact((tr) => {
      const { $from } = tr.selection
      if (!$from.parent.inlineContent) return
      const target =
        $from.start() + Math.min(at.offset, $from.parent.content.size)
      tr.setSelection(TextSelection.create(tr.doc, target))
    })
    placed.current = true
  }, [editor])
  const remember = useCallback(() => {
    placed.current = true
    place.current = {
      blockId: editor.getTextCursorPosition().block.id,
      offset: editor.prosemirrorState.selection.$from.parentOffset,
    }
  }, [editor])
  const focusIn = useCallback(() => {
    focused.current = true
  }, [])
  const focusOut = useCallback(() => {
    focused.current = false
  }, [])
  return { placed, remember, focusIn, focusOut }
}
