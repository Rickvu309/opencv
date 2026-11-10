import { refuse } from "./package-errors.js"

export function uniqueSpan(text: string, before: string) {
  if (!before) refuse("EMPTY_BEFORE_TEXT")
  const at = text.indexOf(before)
  if (at < 0) refuse("BEFORE_TEXT_MISMATCH")
  if (text.indexOf(before, at + 1) >= 0) refuse("AMBIGUOUS_BEFORE_TEXT")
  return { start: at, end: at + before.length }
}

export function changedInterval(before: string, after: string) {
  const left = [...before]
  const right = [...after]
  let prefix = 0
  while (
    prefix < Math.min(left.length, right.length) &&
    left[prefix] === right[prefix]
  )
    prefix++
  let suffix = 0
  while (
    suffix < Math.min(left.length, right.length) - prefix &&
    left[left.length - suffix - 1] === right[right.length - suffix - 1]
  )
    suffix++
  return {
    start: left.slice(0, prefix).join("").length,
    end: left.slice(0, left.length - suffix).join("").length,
    replacement: right.slice(prefix, right.length - suffix).join(""),
  }
}

export function replaceUniqueSpan(text: string, before: string, after: string) {
  const { start, end } = uniqueSpan(text, before)
  return text.slice(0, start) + after + text.slice(end)
}

type ListedRegion = {
  kind: string
  text: string
  location: { paragraph: number }
  targetId?: string
}

export function spansForEdit(
  regions: readonly ListedRegion[],
  edit: { targetId: string; before: string; after: string }
) {
  const start = regions.findIndex(
    (region) => region.kind === "editable" && region.targetId === edit.targetId
  )
  const first = start < 0 ? undefined : regions[start]
  if (!first?.targetId) refuse("STALE_OR_FOREIGN_TARGET")
  const group = [first]
  for (const region of regions.slice(start + 1)) {
    if (
      region.kind !== "editable" ||
      region.location.paragraph !== first.location.paragraph
    )
      break
    if (!region.targetId) refuse("STALE_OR_FOREIGN_TARGET")
    group.push(region)
  }
  const joined = group.map((region) => region.text).join("")
  if (group.length === 1 || edit.before !== joined)
    return [{ targetId: edit.targetId, before: edit.before, after: edit.after }]
  return assignedSpans(group, edit.after)
}

function assignedSpans(
  group: { targetId?: string; text: string }[],
  after: string
) {
  const before = group.map((region) => region.text).join("")
  const interval = changedInterval(before, after)
  let cursor = 0
  const hits: { index: number; cursor: number }[] = []
  for (const [index, region] of group.entries()) {
    const next = cursor + region.text.length
    const point = interval.start === interval.end
    const owns = point
      ? interval.start === 0
        ? index === 0
        : cursor < interval.start && interval.start <= next
      : interval.start < next && interval.end > cursor
    if (owns) hits.push({ index, cursor })
    cursor = next
  }
  if (!hits.length) refuse("BEFORE_TEXT_MISMATCH")
  const first = hits[0]
  const last = hits[hits.length - 1]
  if (!first || !last) refuse("BEFORE_TEXT_MISMATCH")
  return group.flatMap((region, index) => {
    const hit = hits.find((item) => item.index === index)
    if (!hit || !region.targetId) return []
    const prefix =
      index === first.index
        ? region.text.slice(0, interval.start - hit.cursor)
        : ""
    const suffix =
      index === last.index
        ? region.text.slice(Math.max(0, interval.end - hit.cursor))
        : ""
    const middle = index === first.index ? interval.replacement : ""
    const next = prefix + middle + suffix
    if (next === region.text) return []
    return [{ targetId: region.targetId, before: region.text, after: next }]
  })
}
