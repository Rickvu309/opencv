export function photoSelection(element: HTMLElement) {
  let selected: string | null = null
  const listeners = new Set<() => void>()
  const paint = () => {
    for (const photo of element.querySelectorAll<HTMLElement>(
      "[data-paper-photo]"
    )) {
      const active = photo.dataset.paperPhoto === selected
      photo.dataset.selected = String(active)
      photo.setAttribute("aria-pressed", String(active))
      photo.style.outline = active ? "2px solid var(--ring)" : ""
      photo.style.outlineOffset = active ? "3px" : ""
    }
  }
  const selectPhoto = (id: string | null) => {
    selected = id
    paint()
    for (const listener of listeners) listener()
  }
  const click = (event: Event) => {
    if (!(event.target instanceof Element)) return
    const photo = event.target.closest<HTMLElement>("[data-paper-photo]")
    selectPhoto(photo?.dataset.paperPhoto ?? null)
  }
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return
    if (
      !(event.target instanceof HTMLElement) ||
      !event.target.dataset.paperPhoto
    )
      return
    event.preventDefault()
    selectPhoto(event.target.dataset.paperPhoto)
  }
  element.addEventListener("click", click)
  element.addEventListener("keydown", keydown)
  return {
    selectedPhoto: () => selected,
    selectPhoto,
    paint,
    subscribePhotoSelection(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    destroy() {
      element.removeEventListener("click", click)
      element.removeEventListener("keydown", keydown)
      listeners.clear()
    },
  }
}
