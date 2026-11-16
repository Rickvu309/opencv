import {
  layoutPhotoSchema,
  croppedPhotoRatio,
  fitPhotoCrop,
  resizePhoto,
} from "@workspace/domain/internal/paper-presentation"

import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"

type Photo = ReturnType<
  ReturnType<typeof mountRichPaperEditor>["photos"]
>[number]
export const photoNumbers = [
  "width",
  "height",
  "top",
  "right",
  "bottom",
  "left",
] as const
export type PhotoNumber = (typeof photoNumbers)[number]
export type PhotoFields = Record<PhotoNumber, string> & {
  shape: Photo["shape"]
  alignment: "left" | "center" | "right"
  alt: string
}
export type PhotoErrors = Partial<Record<keyof PhotoFields, string>>

export function photoFields(photo: Photo): PhotoFields {
  return {
    width: String(photo.width / 15),
    height: String(photo.height / 15),
    top: String(photo.crop.top / 1000),
    right: String(photo.crop.right / 1000),
    bottom: String(photo.crop.bottom / 1000),
    left: String(photo.crop.left / 1000),
    shape: photo.shape,
    alignment:
      photo.placement.kind === "block"
        ? photo.placement.alignment
        : photo.placement.side,
    alt: photo.alt,
  }
}

export function parsePhotoForm(
  original: Photo,
  fields: PhotoFields,
  commit?: { field: PhotoNumber | "shape"; sourceRatio: number }
):
  | { ok: true; photo: Photo; fields: PhotoFields }
  | { ok: false; errors: PhotoErrors } {
  const errors: PhotoErrors = {}
  const values = { width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }
  for (const name of photoNumbers) {
    const value = Number(fields[name])
    const size = name === "width" || name === "height"
    if (
      !fields[name].trim() ||
      !Number.isFinite(value) ||
      value < (size ? 16 : 0) ||
      value > (size ? 2112 : 99.9)
    )
      errors[name] = size ? "Use 16 to 2112 pixels." : "Use 0 to 99.9 percent."
    values[name] = value
  }
  for (const [first, second] of [
    ["top", "bottom"],
    ["left", "right"],
  ] as const) {
    if (
      Math.round(values[first] * 1000) + Math.round(values[second] * 1000) >=
      100000
    ) {
      errors[first] =
        errors[first] ?? "Keep some of the photo visible. Reduce Top or Bottom."
      errors[second] = errors[second] ?? errors[first]
      if (first === "left") {
        errors[first] = "Keep some of the photo visible. Reduce Left or Right."
        errors[second] = errors[first]
      }
    }
  }
  if (!layoutPhotoSchema.shape.alt.safeParse(fields.alt).success)
    errors.alt = `Use at most ${layoutPhotoSchema.shape.alt.maxLength} characters.`
  if (Object.keys(errors).length) return { ok: false, errors }
  let photo = {
    ...original,
    width: Math.round(values.width * 15),
    height: Math.round(values.height * 15),
    crop: {
      top: Math.round(values.top * 1000),
      right: Math.round(values.right * 1000),
      bottom: Math.round(values.bottom * 1000),
      left: Math.round(values.left * 1000),
    },
    shape: fields.shape,
    placement: {
      kind: "block",
      alignment: fields.alignment,
    } satisfies Photo["placement"],
    alt: fields.alt,
  }
  if (commit) {
    const { field, sourceRatio } = commit
    if (field === "width" || field === "height") {
      photo = resizePhoto(photo, field, photo[field], sourceRatio)
      if (photo.shape === "circle")
        photo = { ...photo, width: photo[field], height: photo[field] }
    } else {
      const crop =
        photo.shape === "circle"
          ? fitPhotoCrop(
              sourceRatio,
              1,
              photo.crop,
              field === "shape" ? undefined : field
            )
          : photo.crop
      photo = {
        ...photo,
        crop,
        height:
          photo.shape === "circle"
            ? photo.width
            : Math.round(photo.width / croppedPhotoRatio(sourceRatio, crop)),
      }
    }
    return { ok: true, photo, fields: photoFields(photo) }
  }
  const parsed = layoutPhotoSchema.safeParse(photo)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if (field === "width" || field === "height")
        errors[field] = "Use 16 to 2112 pixels."
      else if (field === "alt")
        errors.alt = `Use at most ${layoutPhotoSchema.shape.alt.maxLength} characters.`
      else {
        errors.width = "Use equal Width and Height for a circle."
        errors.height = errors.width
      }
    }
    return { ok: false, errors }
  }
  return { ok: true, photo, fields }
}
