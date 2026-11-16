import { TextSelection } from "@tiptap/pm/state"
import { yUndoPluginKey } from "y-prosemirror"
import {
  canonical,
  layoutPhotoSchema,
  photoDestination,
  fitPhotoCrop,
  photoInsertSize,
} from "@workspace/domain/internal/paper-presentation"
import {
  commitFlowPhotoEdit,
  readFlow,
  type FlowBinding,
} from "./native-layout-flow.js"
import type { PrivateLayoutEditor } from "./native-layout-schema.js"

export function flowPhotoControls(
  binding: FlowBinding,
  editor: PrivateLayoutEditor
) {
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
      const { width: available, ...destination } = photoDestination(
        document,
        cursor
      )
      const { width, height } = photoInsertSize(aspectRatio, available)
      const photo = layoutPhotoSchema.parse({
        id: crypto.randomUUID(),
        type: "photo",
        source,
        width,
        height,
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
        destination,
      })
      return photo.id
    },
    updatePhoto(input: unknown) {
      change({ kind: "update-photo", photo: layoutPhotoSchema.parse(input) })
    },
    replacePhoto(photoId: string, source: string, aspectRatio?: number) {
      const photo = photos().find((photo) => photo.id === photoId)
      if (!photo) throw new Error("Photo is missing")
      change({
        kind: "update-photo",
        photo: {
          ...photo,
          source,
          crop:
            aspectRatio === undefined
              ? photo.crop
              : fitPhotoCrop(aspectRatio, photo.width / photo.height, {
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                }),
        },
      })
    },
    removePhoto(photoId: string) {
      const state = editor.prosemirrorState
      const selection =
        TextSelection.findFrom(state.selection.$from, -1, true) ??
        TextSelection.findFrom(state.selection.$to, 1, true)
      if (!selection) throw new Error("Place the cursor in the document")
      editor.prosemirrorView.dispatch(state.tr.setSelection(selection))
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
