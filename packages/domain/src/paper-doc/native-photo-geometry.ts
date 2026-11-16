import type { LayoutPhoto } from "./native-photo.js"

type PhotoGeometry = Pick<LayoutPhoto, "width" | "height" | "crop">

export function photoSourceRatio(photo: PhotoGeometry) {
  return (
    (photo.width / photo.height) *
    ((100000 - photo.crop.top - photo.crop.bottom) /
      (100000 - photo.crop.left - photo.crop.right))
  )
}

export function croppedPhotoRatio(
  sourceRatio: number,
  crop: LayoutPhoto["crop"]
) {
  return (
    (sourceRatio * (100000 - crop.left - crop.right)) /
    (100000 - crop.top - crop.bottom)
  )
}

export function fitPhotoCrop(
  sourceRatio: number,
  frameRatio: number,
  crop: LayoutPhoto["crop"],
  editedEdge?: keyof LayoutPhoto["crop"]
) {
  if (editedEdge)
    return fitEditedCrop(sourceRatio, frameRatio, crop, editedEdge)
  const visibleRatio = croppedPhotoRatio(sourceRatio, crop)
  if (!Number.isFinite(visibleRatio) || visibleRatio <= 0 || frameRatio <= 0)
    throw new Error("Keep some of the photo visible")
  const next = { ...crop }
  if (visibleRatio > frameRatio) {
    const trim = Math.round(
      (100000 - crop.left - crop.right) * (1 - frameRatio / visibleRatio)
    )
    next.left += Math.floor(trim / 2)
    next.right += Math.ceil(trim / 2)
  } else {
    const trim = Math.round(
      (100000 - crop.top - crop.bottom) * (1 - visibleRatio / frameRatio)
    )
    next.top += Math.floor(trim / 2)
    next.bottom += Math.ceil(trim / 2)
  }
  return next
}

export function resizePhoto<T extends PhotoGeometry>(
  photo: T,
  dimension: "width" | "height",
  value: number,
  sourceRatio: number
) {
  const ratio = croppedPhotoRatio(sourceRatio, photo.crop)
  return {
    ...photo,
    width: dimension === "width" ? value : Math.round(value * ratio),
    height: dimension === "height" ? value : Math.round(value / ratio),
  }
}

function fitEditedCrop(
  sourceRatio: number,
  frameRatio: number,
  crop: LayoutPhoto["crop"],
  editedEdge: keyof LayoutPhoto["crop"]
) {
  const ratio = sourceRatio / frameRatio
  const weights = { left: ratio, right: ratio, top: -1, bottom: -1 }
  const edges = ["left", "right", "top", "bottom"] as const
  const target = (ratio - 1) * 100000
  const project = (edge: keyof typeof crop, offset: number) =>
    edge === editedEdge
      ? crop[edge]
      : Math.max(0, Math.min(99999, crop[edge] - offset * weights[edge]))
  let low = -100000 / Math.min(ratio, 1)
  let high = -low
  for (let step = 0; step < 64; step++) {
    const offset = (low + high) / 2
    const total = edges.reduce(
      (sum, edge) => sum + weights[edge] * project(edge, offset),
      0
    )
    if (total > target) low = offset
    else high = offset
  }
  return {
    left: Math.round(project("left", high)),
    right: Math.round(project("right", high)),
    top: Math.round(project("top", high)),
    bottom: Math.round(project("bottom", high)),
  }
}
