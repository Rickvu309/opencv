const TAB_STOP_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "iframe",
  "summary",
  "[contenteditable]",
  "[tabindex]",
].join(",")

function isUncheckedRadioInAnsweredGroup(element: HTMLElement) {
  if (!(element instanceof HTMLInputElement)) return false
  if (element.type !== "radio" || element.checked || !element.name) return false
  const scope = element.form ?? element.ownerDocument
  return Array.from(
    scope.querySelectorAll<HTMLInputElement>('input[type="radio"]')
  ).some((other) => other.name === element.name && other.checked)
}

function isTabStop(element: HTMLElement) {
  if (element.tabIndex < 0) return false
  if (element.matches(":disabled")) return false
  if (element.closest("[hidden],[inert]")) return false
  if (element instanceof HTMLInputElement && element.type === "hidden")
    return false
  if (isUncheckedRadioInAnsweredGroup(element)) return false
  return element.checkVisibility?.({ visibilityProperty: true }) !== false
}

export function dialogTabStops(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(TAB_STOP_SELECTOR)
  ).filter(isTabStop)
}

export function wrappedTabStop(
  root: HTMLElement,
  active: Element | null,
  backwards: boolean
): HTMLElement | null {
  const stops = dialogTabStops(root)
  const first = stops[0]
  const last = stops[stops.length - 1]
  if (!first || !last) return null
  if (backwards) return active === first || active === root ? last : null
  return active === last ? first : null
}

const TEXT_ENTRY_SELECTOR = [
  "textarea",
  "[contenteditable]:not([contenteditable='false'])",
  "input:not([type='button'],[type='submit'],[type='reset'],[type='checkbox'],[type='radio'],[type='file'],[type='range'],[type='color'],[type='image'])",
].join(",")

export function openingFocusTarget(root: HTMLElement): HTMLElement {
  return (
    dialogTabStops(root).find((stop) => stop.matches(TEXT_ENTRY_SELECTOR)) ??
    root
  )
}
