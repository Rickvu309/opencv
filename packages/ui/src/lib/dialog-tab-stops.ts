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

function isTabStop(element: HTMLElement) {
  if (element.tabIndex < 0) return false
  if ((element as HTMLButtonElement).disabled) return false
  if (element.closest("[hidden],[inert]")) return false
  if (element instanceof HTMLInputElement && element.type === "hidden")
    return false
  return element.checkVisibility?.() !== false
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
