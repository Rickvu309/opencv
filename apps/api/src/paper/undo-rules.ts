export type EditRow = {
  readonly seq: number
  readonly origin: string
  readonly editId: string | null
  readonly basedOn: number | null
  readonly touched: readonly string[] | null
  readonly rebuilt?: readonly string[] | null
}

export const NEWER_FIRST =
  "Undo the newer Coach edit first. It was made on top of this one and changed the same blocks."

export function revertedIds(rows: readonly EditRow[]): Set<string | null> {
  return new Set(
    rows.filter((row) => row.origin === "revert").map((row) => row.editId)
  )
}

export function blockingEdit(
  rows: readonly EditRow[],
  target: EditRow
): EditRow | undefined {
  const reverted = revertedIds(rows)
  const touched = new Set(target.touched ?? [])
  return rows.find(
    (row) =>
      row.origin === "coach" &&
      row.seq > target.seq &&
      row.editId !== target.editId &&
      !reverted.has(row.editId) &&
      (row.basedOn ?? 0) >= target.seq &&
      (row.touched ?? []).some((id) => touched.has(id))
  )
}

export function blockedReason(
  rows: readonly EditRow[],
  editId: string
): string | null {
  const target = rows.find(
    (row) => row.origin === "coach" && row.editId === editId
  )
  if (!target) return "This edit is no longer in the document's history"
  if (revertedIds(rows).has(editId)) return "This edit was already undone"
  return blockingEdit(rows, target) ? NEWER_FIRST : null
}
