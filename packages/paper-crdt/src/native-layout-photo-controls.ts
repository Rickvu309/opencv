import { yUndoPluginKey } from "y-prosemirror"
import {
  canonical,
  layoutPhotoSchema,
} from "@workspace/domain/internal/paper-presentation"
import {
  commitFlowPhotoEdit,
  readFlow,
  type FlowBinding,
} from "./native-layout-flow.js"
import type { mountPrivateFlow } from "./native-layout-flow-mount.js"

export function flowPhotoControls(
  binding: FlowBinding,
  mounted: ReturnType<typeof mountPrivateFlow>
) {
  const editor = mounted.editor
  const history = yUndoPluginKey.getState(editor.prosemirrorState)?.undoManager
  if (!history) throw new Error("Photo editing needs document history")
  history.addTrackedOrigin("private-flow-photo")
  const change = (edit: unknown) => {
    if (!editor.isEditable) throw new Error("Paper is not ready for editing")
    history.stopCapturing()
    const result = commitFlowPhotoEdit(
      binding,
      edit,
      canonical(readFlow(binding))
    )
    if (result.kind === "refused") throw new Error(result.reason)
    history.stopCapturing()
  }
  const photos = () =>
    readFlow(binding).flow.children.flatMap((section) =>
      section.children.flatMap((node) =>
        node.type === "photo"
          ? [node]
          : node.type === "table"
            ? node.children.flatMap((row) =>
                row.children.flatMap((cell) =>
                  cell.children.filter((child) => child.type === "photo")
                )
              )
            : []
      )
    )
  return {
    photos,
    insertPhoto(source: string, aspectRatio = 1) {
      const document = readFlow(binding)
      const cursor = editor.getTextCursorPosition().block.id
      const section =
        document.flow.children.find((section) =>
          section.children.some(
            (node) =>
              node.id === cursor ||
              ("children" in node &&
                node.children.some((child) => child.id === cursor))
          )
        ) ?? document.flow.children[0]
      if (!section) throw new Error("Photo insertion point is missing")
      const anchor = section.children.find(
        (node) =>
          node.id === cursor ||
          ("children" in node &&
            node.children.some((child) => child.id === cursor))
      )
      const width = Math.min(
        2160,
        Math.floor(
          (section.page.width -
            section.page.start -
            section.page.end -
            (section.columns.count - 1) * section.columns.gap) /
            section.columns.count
        )
      )
      const photo = layoutPhotoSchema.parse({
        id: crypto.randomUUID(),
        type: "photo",
        source,
        width,
        height: Math.max(240, Math.min(31680, Math.round(width / aspectRatio))),
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        rotation: 0,
        shape: "rectangle",
        placement: { kind: "block", alignment: "left" },
        spacing: { top: 0, right: 0, bottom: 0, left: 0 },
        alt: "",
      })
      change({
        kind: "insert-photo",
        photo,
        destination: { parentId: section.id, afterId: anchor?.id ?? null },
      })
      return photo.id
    },
    updatePhoto(input: unknown) {
      change({ kind: "update-photo", photo: layoutPhotoSchema.parse(input) })
    },
    replacePhoto(photoId: string, source: string) {
      change({ kind: "replace-photo", photoId, source })
    },
    removePhoto(photoId: string) {
      change({ kind: "remove-photo", photoId })
    },
    undoPhoto() {
      editor.undo()
    },
    redoPhoto() {
      editor.redo()
    },
    photoHistory() {
      return {
        undo: history.undoStack.length > 0,
        redo: history.redoStack.length > 0,
      }
    },
  }
}
