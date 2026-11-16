import {
  layoutPhotoSchema,
  fitPhotoCrop,
  resizePhoto,
  photoSourceRatio,
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
    width: String(Math.round((photo.width / 15) * 100) / 100),
    height: String(Math.round((photo.height / 15) * 100) / 100),
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
  sourceRatio = photoSourceRatio(original),
  editedField?: PhotoNumber | "shape"
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
      if (!errors[first] && !errors[second]) {
        const field =
          editedField === first || editedField === second
            ? editedField
            : fields[second] !== photoFields(original)[second]
              ? second
              : first
        errors[field] =
          `Keep some of the photo visible. Reduce ${field[0].toUpperCase() + field.slice(1)}.`
      }
    }
  }
  if (!layoutPhotoSchema.shape.alt.safeParse(fields.alt).success)
    errors.alt = `Use at most ${layoutPhotoSchema.shape.alt.maxLength} characters.`
  if (Object.keys(errors).length) return { ok: false, errors }
  const initial = photoFields(original)
  let photo: Photo = {
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
    placement:
      fields.alignment === initial.alignment
        ? original.placement
        : { kind: "block", alignment: fields.alignment },
    alt: fields.alt,
  }
  const geometryChanged = [...photoNumbers, "shape" as const].some(
    (field) => fields[field] !== initial[field]
  )
  const editedEdge =
    editedField &&
    editedField !== "width" &&
    editedField !== "height" &&
    editedField !== "shape"
      ? editedField
      : undefined
  const crop =
    photo.shape === "circle"
      ? fitPhotoCrop(sourceRatio, 1, photo.crop, editedEdge)
      : photo.crop
  photo = { ...photo, crop }
  if (geometryChanged) {
    const dimension =
      editedField === "height" ||
      (!editedField &&
        fields.width === initial.width &&
        fields.height !== initial.height)
        ? "height"
        : "width"
    photo =
      photo.shape === "circle"
        ? { ...photo, width: photo[dimension], height: photo[dimension] }
        : resizePhoto(photo, dimension, photo[dimension], sourceRatio)
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
  return { ok: true, photo, fields: photoFields(photo) }
}
