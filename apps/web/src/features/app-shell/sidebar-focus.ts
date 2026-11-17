export function focusIsInSidebar() {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  return active.closest('[data-slot="sidebar-frame"]') !== null
}

export function pageFocusTarget() {
  return (
    document.querySelector<HTMLElement>(
      '#app-main [data-slot="sidebar-expand"]'
    ) ?? document.getElementById("app-main")
  )
}

export function sidebarFocusTarget() {
  return document.querySelector<HTMLElement>(
    '[data-slot="sidebar-frame"] aside a, [data-slot="sidebar-frame"] aside button'
  )
}

export function focusIsInExpandButton() {
  const active = document.activeElement
  return (
    active instanceof HTMLElement &&
    active.matches('#app-main [data-slot="sidebar-expand"]')
  )
}
