import { ImagePlus, Image, Undo2, Redo2 } from "lucide-react"
import {
  ToolbarButton,
  shortcutLabel,
  type TextEditor,
} from "./rich-text-toolbar-control.tsx"

import { useToolbarGroup } from "./rich-text-toolbar-item.tsx"

export function RichDocumentHistory({
  editor,
  blocked,
}: {
  editor: TextEditor | null
  blocked: boolean
}) {
  const history = editor?.documentHistory()
  return (
    <fieldset
      disabled={!editor || blocked}
      aria-label="Document history"
      className="flex shrink-0 items-center gap-1"
    >
      <ToolbarButton
        label={shortcutLabel("Undo (Ctrl+Z)")}
        disabled={!editor || blocked || !history?.undo}
        onClick={() => {
          editor?.undoDocument()
          editor?.focus()
        }}
      >
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton
        label={shortcutLabel("Redo (Ctrl+Shift+Z)")}
        disabled={!editor || blocked || !history?.redo}
        onClick={() => {
          editor?.redoDocument()
          editor?.focus()
        }}
      >
        <Redo2 />
      </ToolbarButton>
    </fieldset>
  )
}

export function RichPhotoToolbar({
  held,
  hasPhotos,
  onInsert,
  onEdit,
}: {
  held: boolean
  hasPhotos: boolean
  onInsert: () => void
  onEdit: () => void
}) {
  const group = useToolbarGroup(["Insert photo", "Edit photo"])
  return (
    <fieldset
      {...group}
      disabled={held}
      aria-label="Photos"
      className="flex shrink-0 items-center gap-1"
    >
      <ToolbarButton label="Insert photo" disabled={held} onClick={onInsert}>
        <ImagePlus />
      </ToolbarButton>
      <ToolbarButton
        label="Edit photo"
        disabled={held || !hasPhotos}
        onClick={onEdit}
      >
        <Image />
      </ToolbarButton>
    </fieldset>
  )
}
