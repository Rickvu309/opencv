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
