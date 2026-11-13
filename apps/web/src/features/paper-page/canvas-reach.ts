import type { TextSpan, WritingDraft } from "./canvas-edit.ts"

export type Reach = "character" | "word" | "line" | "selection"

const SPACE = /\s/

function collapsed(span: TextSpan) {
  return (
    span.anchor.blockId === span.focus.blockId &&
    span.anchor.offset === span.focus.offset
  )
}

function wordStart(text: string, offset: number) {
  let at = offset
  while (at > 0 && SPACE.test(text.charAt(at - 1))) at -= 1
  while (at > 0 && !SPACE.test(text.charAt(at - 1))) at -= 1
  return at
}

function wordEnd(text: string, offset: number) {
  let at = offset
  while (at < text.length && SPACE.test(text.charAt(at))) at += 1
  while (at < text.length && !SPACE.test(text.charAt(at))) at += 1
  return at
}

export function reachSpan(
  draft: WritingDraft,
  span: TextSpan,
  direction: "backward" | "forward",
  reach: Reach
): TextSpan {
  if (!collapsed(span) || reach === "character" || reach === "selection")
    return span
  const block = draft.blocks.find((item) => item.id === span.anchor.blockId)
  if (!block) return span
  const offset = Math.max(0, Math.min(span.anchor.offset, block.text.length))
  const edge =
    direction === "backward"
      ? reach === "word"
        ? wordStart(block.text, offset)
        : 0
      : reach === "word"
        ? wordEnd(block.text, offset)
        : block.text.length
  if (edge === offset) return span
  return {
    anchor: { blockId: block.id, offset: Math.min(offset, edge) },
    focus: { blockId: block.id, offset: Math.max(offset, edge) },
  }
}
