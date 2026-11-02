const EXPAND_TOGGLE =
  '[data-slot="sidebar-expand"] [data-slot="sidebar-toggle"]'
const COLLAPSE_TOGGLE = '[data-slot="shell-nav"] [data-slot="sidebar-toggle"]'

function activeElement() {
  const active = document.activeElement
  return active instanceof HTMLElement ? active : null
}

export function focusIsInSidebar() {
  const active = activeElement()
  if (!active) return false
  return active.closest('[data-slot="sidebar-frame"]') !== null
}

export const HANDOFF_ATTRIBUTE = "data-handoff"

export function focusNeedsHandoff() {
  const active = activeElement()
  if (active === null || active === document.body) return false
  if (active.closest('[data-slot="sidebar-toggle"]')) return true
  return focusIsInSidebar()
}

function markHandoff(element: HTMLElement | null) {
  element?.setAttribute(HANDOFF_ATTRIBUTE, "")
  return element
}

export function focusSidebarToggle(direction: "expand" | "collapse") {
  const selector = direction === "expand" ? EXPAND_TOGGLE : COLLAPSE_TOGGLE
  markHandoff(document.querySelector<HTMLElement>(selector))?.focus()
}

export function handoffTarget() {
  return markHandoff(document.querySelector<HTMLElement>(EXPAND_TOGGLE))
}
