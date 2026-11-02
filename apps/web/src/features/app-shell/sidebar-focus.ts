export function focusIsInSidebar() {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  return active.closest('[data-slot="sidebar-frame"]') !== null
}

export function pageFocusTarget() {
  return document.getElementById("app-main")
}
