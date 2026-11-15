import { createBlockSpec } from "@blocknote/core"
import {
  layoutPhotoSchema,
  photoBounds,
  type LayoutPhoto,
} from "@workspace/domain/internal/paper-presentation"

export type PhotoUrlResolver = (
  source: LayoutPhoto["source"]
) => string | undefined
const resolvers = new WeakMap<object, PhotoUrlResolver>()
export function setPhotoResolver(editor: object, resolver?: PhotoUrlResolver) {
  if (resolver) resolvers.set(editor, resolver)
  else resolvers.delete(editor)
}
export function photoElement(photo: LayoutPhoto, source?: string) {
  const dom = document.createElement("figure")
  const bounds = photoBounds(photo)
  dom.dataset.paperPhoto = photo.id
  dom.contentEditable = "false"
  dom.style.position = "relative"
  dom.style.width = `${(bounds.width + photo.spacing.left + photo.spacing.right) / 20}pt`
  dom.style.height = `${(bounds.height + photo.spacing.top + photo.spacing.bottom) / 20}pt`
  dom.style.margin = "0"
  if (photo.placement.kind === "wrap") dom.style.cssFloat = photo.placement.side
  else {
    dom.style.clear = "both"
    if (photo.placement.alignment === "center") {
      dom.style.marginLeft = "auto"
      dom.style.marginRight = "auto"
    } else if (photo.placement.alignment === "right")
      dom.style.marginLeft = "auto"
  }
  const frame = document.createElement("div")
  frame.style.position = "absolute"
  frame.style.width = `${photo.width / 20}pt`
  frame.style.height = `${photo.height / 20}pt`
  frame.style.left = `${(bounds.width - photo.width) / 40 + photo.spacing.left / 20}pt`
  frame.style.top = `${(bounds.height - photo.height) / 40 + photo.spacing.top / 20}pt`
  frame.style.overflow = "hidden"
  frame.style.transform = `rotate(${photo.rotation}deg)`
  frame.style.transformOrigin = "center"
  frame.style.borderRadius =
    photo.shape === "circle"
      ? "50%"
      : photo.shape === "rounded"
        ? `${Math.min(photo.width, photo.height) / 120}pt`
        : "0"
  if (source) {
    const image = document.createElement("img")
    image.src = source
    image.alt = photo.alt
    image.draggable = false
    image.style.position = "absolute"
    image.style.maxWidth = "none"
    image.style.width = `${10000000 / (100000 - photo.crop.left - photo.crop.right)}%`
    image.style.height = `${10000000 / (100000 - photo.crop.top - photo.crop.bottom)}%`
    image.style.left = `${(-photo.crop.left * 100) / (100000 - photo.crop.left - photo.crop.right)}%`
    image.style.top = `${(-photo.crop.top * 100) / (100000 - photo.crop.top - photo.crop.bottom)}%`
    frame.append(image)
  } else {
    frame.setAttribute("role", "img")
    frame.setAttribute("aria-label", photo.alt || "Photo")
    frame.dataset.paperPhotoUnavailable = "true"
  }
  dom.append(frame)
  return dom
}
export const photoBlockSpec = createBlockSpec(
  {
    type: "paperPhoto",
    content: "none",
    propSchema: { photo: { default: "" } },
  },
  {
    render: (block, editor) => {
      const photo = layoutPhotoSchema.parse(JSON.parse(block.props.photo))
      if (photo.id !== block.id) throw new Error("Photo identities disagree")
      return { dom: photoElement(photo, resolvers.get(editor)?.(photo.source)) }
    },
  }
)()
