import { ImagePlus, Image, Undo2, Redo2 } from "lucide-react"
import { ToolbarButton } from "./rich-text-toolbar-control.tsx"

export function RichPhotoToolbar({
  held,
  canUndo,
  canRedo,
  hasPhotos,
  onUndo,
  onRedo,
  onInsert,
  onEdit,
}: {
  held: boolean
  canUndo: boolean
  canRedo: boolean
  hasPhotos: boolean
  onUndo: () => void
  onRedo: () => void
  onInsert: () => void
  onEdit: () => void
}) {
  return (
    <>
      <fieldset
        disabled={held}
        aria-label="Photos"
        className="flex shrink-0 items-center gap-1"
      >
        <ToolbarButton
          label="Undo"
          disabled={held || !canUndo}
          onClick={onUndo}
        >
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={held || !canRedo}
          onClick={onRedo}
        >
          <Redo2 />
        </ToolbarButton>
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
      <div
        role="separator"
        aria-orientation="vertical"
        className="h-6 border-s border-border"
      />
    </>
  )
}
