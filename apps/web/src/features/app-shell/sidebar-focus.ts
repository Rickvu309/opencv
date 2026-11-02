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

export function focusNeedsHandoff() {
  const active = activeElement()
  if (active === null || active === document.body) return true
  if (active.closest('[data-slot="sidebar-toggle"]')) return true
  return focusIsInSidebar()
}

export function focusSidebarToggle(direction: "expand" | "collapse") {
  const selector = direction === "expand" ? EXPAND_TOGGLE : COLLAPSE_TOGGLE
  document.querySelector<HTMLElement>(selector)?.focus()
}

export function expandToggleElement() {
  return document.querySelector<HTMLElement>(EXPAND_TOGGLE)
}
