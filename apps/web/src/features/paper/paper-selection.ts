import {
  COACH_SELECTION_SECTION_ID_MAX,
  COACH_SELECTION_TEXT_MAX,
  type CoachSelection,
} from "@workspace/domain"

function sectionIdFromElement(el: Element | null, root?: Element | null) {
  const section = el?.closest("[data-paper-section]")
  if (root && section && !root.contains(section)) return undefined
  const id = section?.getAttribute("data-paper-section")?.trim()
  if (!id) return undefined
  return id.slice(0, COACH_SELECTION_SECTION_ID_MAX)
}

function capSelection(text: string, sectionId?: string): CoachSelection {
  const next: CoachSelection = {
    text: text.slice(0, COACH_SELECTION_TEXT_MAX),
  }
  if (sectionId) next.sectionId = sectionId
  return next
}

/** Current Paper selection, if the caret is inside the editor. */
export function readPaperSelection(
  root?: HTMLElement | null
): CoachSelection | null {
  const active = document.activeElement
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement
  ) {
    if (root && !root.contains(active)) return null
    const start = active.selectionStart ?? 0
    const end = active.selectionEnd ?? 0
    if (end <= start) return null
    const text = active.value.slice(start, end).trim()
    if (!text) return null
    return capSelection(text, sectionIdFromElement(active, root))
  }

  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return null
  const text = sel.toString().trim()
  if (!text) return null
  const node = sel.anchorNode
  const el = node instanceof Element ? node : node?.parentElement
  if (!el) return null
  if (root && !root.contains(el)) return null
  return capSelection(text, sectionIdFromElement(el, root))
}
