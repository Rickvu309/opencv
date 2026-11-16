import { flowDocumentSchema } from "./native-layout-flow.js"
import { layoutPhotoEditSchema } from "./native-photo-edit.js"
import { canonical, ok, refuse } from "./presentation-values.js"

export function prepareFlowPhotoEdit(input: unknown, change: unknown) {
  try {
    const document = flowDocumentSchema.parse(input)
    const edit = layoutPhotoEditSchema.parse(change)
    const parents = document.flow.children.flatMap((section) => [
      section,
      ...section.children.flatMap((node) =>
        node.type === "table"
          ? node.children.flatMap((row) => row.children)
          : []
      ),
    ])
    const photoId =
      edit.kind === "insert-photo" || edit.kind === "update-photo"
        ? edit.photo.id
        : edit.photoId
    const parent = parents.find((parent) =>
      parent.children.some(
        (node) => node.type === "photo" && node.id === photoId
      )
    )
    const index =
      parent?.children.findIndex((node) => node.id === photoId) ?? -1
    const before = parent?.children[index]
    if (edit.kind !== "insert-photo" && before?.type !== "photo")
      throw new Error("Choose a photo to edit")
    if (edit.kind === "insert-photo" && parent)
      throw new Error("Photo identity is already in use")
    if (edit.kind === "update-photo" || edit.kind === "replace-photo") {
      if (!parent || before?.type !== "photo")
        throw new Error("Photo is missing")
      parent.children.splice(index, 1, {
        ...(edit.kind === "update-photo" ? edit.photo : before),
        ...(edit.kind === "replace-photo" ? { source: edit.source } : {}),
      })
    } else {
      if (edit.kind === "remove-photo" || edit.kind === "move-photo")
        parent?.children.splice(index, 1)
      if (edit.kind === "insert-photo" || edit.kind === "move-photo") {
        const destination = parents.find(
          (node) => node.id === edit.destination.parentId
        )
        if (!destination) throw new Error("Photo insertion point is missing")
        const offset =
          edit.destination.afterId === null
            ? 0
            : destination.children.findIndex(
                (node) => node.id === edit.destination.afterId
              ) + 1
        if (edit.destination.afterId !== null && offset === 0)
          throw new Error("Photo insertion neighbor is missing")
        const photo = edit.kind === "insert-photo" ? edit.photo : before
        if (photo?.type !== "photo") throw new Error("Photo is missing")
        destination.children.splice(offset, 0, photo)
      }
    }
    const after = flowDocumentSchema.parse(document)
    return ok({ document: after, basis: canonical(input) })
  } catch (error) {
    return refuse(error instanceof Error ? error.message : "Photo edit refused")
  }
}
