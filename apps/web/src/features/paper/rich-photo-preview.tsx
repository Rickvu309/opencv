import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"
import { resolvePhotoSrc } from "@/lib/requests.ts"

type LayoutPhoto = ReturnType<
  ReturnType<typeof mountRichPaperEditor>["photos"]
>[number]

export function RichPhotoPreview({
  selected,
  onSourceRatio,
}: {
  selected: LayoutPhoto
  onSourceRatio: (ratio: number) => void
}) {
  const width = Math.min(240, (144 * selected.width) / selected.height)
  const height = (width * selected.height) / selected.width
  return (
    <div
      role="img"
      aria-label={
        selected.alt ? `Photo preview: ${selected.alt}` : "Photo preview"
      }
      className="relative mx-auto overflow-clip"
      style={{
        width,
        aspectRatio: `${selected.width} / ${selected.height}`,
        borderRadius:
          selected.shape === "circle"
            ? "50%"
            : selected.shape === "rounded"
              ? Math.min(width, height) / 6
              : 0,
      }}
    >
      <img
        src={resolvePhotoSrc(selected.source)}
        alt=""
        onLoad={(event) => {
          const image = event.currentTarget
          onSourceRatio(image.naturalWidth / image.naturalHeight)
        }}
        className="absolute max-w-none"
        style={{
          width: `${10000000 / (100000 - selected.crop.left - selected.crop.right)}%`,
          height: `${10000000 / (100000 - selected.crop.top - selected.crop.bottom)}%`,
          left: `${(-selected.crop.left * 100) / (100000 - selected.crop.left - selected.crop.right)}%`,
          top: `${(-selected.crop.top * 100) / (100000 - selected.crop.top - selected.crop.bottom)}%`,
        }}
      />
    </div>
  )
}
