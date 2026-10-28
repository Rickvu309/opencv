/** Café keyboard for structured Paper CV fields (QVE-208). */

export const PAPER_CANVAS_FIELD_SELECTOR = "[data-paper-canvas-field]"

export function listCanvasFields(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(PAPER_CANVAS_FIELD_SELECTOR)]
}

export function canvasFieldRoot(current: HTMLElement): ParentNode {
  return (
    current.closest("[data-paper-canvas]") ??
    current.closest(".cv-template-root") ??
    document
  )
}

export function focusCanvasField(el: HTMLElement) {
  el.focus()
  const doc = el.ownerDocument
  try {
    const range = doc.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = doc.defaultView?.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  } catch {
    // Empty node / jsdom — focus is enough.
  }
  el.scrollIntoView?.({ block: "nearest" })
}

export function focusAdjacentCanvasField(
  current: HTMLElement,
  direction: 1 | -1
): HTMLElement | null {
  const fields = listCanvasFields(canvasFieldRoot(current))
  const index = fields.indexOf(current)
  if (index < 0) return null
  const next = fields[index + direction]
  if (!next) return null
  focusCanvasField(next)
  return next
}

type FieldKeyEvent = {
  key: string
  shiftKey: boolean
  preventDefault: () => void
  stopPropagation: () => void
  currentTarget: EventTarget | null
  nativeEvent?: { isComposing?: boolean }
  isComposing?: boolean
}

/** Tab walks structured fields; Esc blurs without trapping or closing Coach. */
export function handleCanvasFieldKeyDown(event: FieldKeyEvent): boolean {
  const composing = event.nativeEvent?.isComposing ?? event.isComposing
  if (composing) return false
  const current = event.currentTarget
  if (!(current instanceof HTMLElement)) return false

  if (event.key === "Escape") {
    event.preventDefault()
    event.stopPropagation()
    current.blur()
    return true
  }

  if (event.key !== "Tab") return false

  const next = focusAdjacentCanvasField(current, event.shiftKey ? -1 : 1)
  if (next) {
    event.preventDefault()
    return true
  }

  event.preventDefault()
  current.blur()
  return true
}
