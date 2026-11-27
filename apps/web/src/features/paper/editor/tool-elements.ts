export function toolButton(label: string, act: () => void, name?: string) {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = label
  if (name) button.setAttribute("aria-label", name)
  button.addEventListener("click", act)
  return button
}

export function toolField(label: string) {
  const input = document.createElement("input")
  input.type = "text"
  input.placeholder = label
  input.setAttribute("aria-label", label)
  input.autocomplete = "off"
  return input
}

export function placePopover(
  element: HTMLElement,
  x: number,
  y: number,
  maxWidth: number
) {
  element.style.left = `clamp(12px, ${x}px, max(12px, 100% - ${maxWidth + 12}px))`
  element.style.top = `min(${y + 6}px, calc(100% - 58px))`
}
