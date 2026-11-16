import type { ReactNode } from "react"
import { ImagePlus, Image, Undo2, Redo2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export function RichPhotoToolbar({
  held,
  canUndo,
  canRedo,
  hasPhotos,
  onUndo,
  onRedo,
  onInsert,
  onEdit,
  children,
}: {
  held: boolean
  canUndo: boolean
  canRedo: boolean
  hasPhotos: boolean
  onUndo: () => void
  onRedo: () => void
  onInsert: () => void
  onEdit: () => void
  children: ReactNode
}) {
  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex items-center gap-3 overflow-x-auto border-b px-4 py-2"
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 md:size-8"
        aria-label="Undo"
        disabled={held || !canUndo}
        onClick={onUndo}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 md:size-8"
        aria-label="Redo"
        disabled={held || !canRedo}
        onClick={onRedo}
      >
        <Redo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 md:size-8"
        aria-label="Insert photo"
        disabled={held}
        onClick={onInsert}
      >
        <ImagePlus />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 md:size-8"
        aria-label="Edit photo"
        disabled={held || !hasPhotos}
        onClick={onEdit}
      >
        <Image />
      </Button>
      {children}
    </div>
  )
}
