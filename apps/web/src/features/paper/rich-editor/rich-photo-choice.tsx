import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

type LayoutPhoto = ReturnType<
  ReturnType<typeof mountRichPaperEditor>["photos"]
>[number]

export function RichPhotoChoice({
  photos,
  selectedId,
  disabled,
  onChoose,
}: {
  photos: LayoutPhoto[]
  selectedId: string
  disabled: boolean
  onChoose: (id: string | null) => void
}) {
  return photos.length > 1 ? (
    <label className="grid min-w-0 gap-1">
      Photo
      <Select
        value={selectedId}
        items={photos.map((photo, index) => ({
          value: photo.id,
          label: photo.alt || `Photo ${index + 1}`,
        }))}
        disabled={disabled}
        onValueChange={onChoose}
      >
        <SelectTrigger
          aria-label="Choose photo"
          className="w-full min-w-0 data-[size=default]:h-11 [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:truncate"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-w-[calc(100vw-2rem)]">
          {photos.map((photo, index) => (
            <SelectItem
              key={photo.id}
              value={photo.id}
              className="[&_[data-slot=photo-option]]:truncate [&>div]:min-w-0 [&>div]:shrink"
            >
              <span
                data-slot="photo-option"
                title={photo.alt || `Photo ${index + 1}`}
              >
                {photo.alt || `Photo ${index + 1}`}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  ) : null
}
