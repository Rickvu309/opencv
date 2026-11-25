export const OLD_EDITOR_UNDO_REASON =
  "This change was saved by the old editor and can't be undone."

export const OLD_PHOTO_UNDO_REASON =
  "This photo was saved by the old editor and can't be undone."

export async function oldEditorUndoReasons(
  _userId: string,
  items: readonly { source: string | null }[]
): Promise<(string | null)[]> {
  return items.map((item) =>
    item.source === "paper.attachPhoto"
      ? OLD_PHOTO_UNDO_REASON
      : OLD_EDITOR_UNDO_REASON
  )
}
