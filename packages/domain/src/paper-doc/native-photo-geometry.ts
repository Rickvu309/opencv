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
  crop: LayoutPhoto["crop"]
) {
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
