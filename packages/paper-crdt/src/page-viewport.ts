export function scalePaperPage(element: HTMLElement, width: number) {
  const viewport = element.parentElement?.hasAttribute(
    "data-paper-page-viewport"
  )
    ? element.parentElement
    : null
  const parent = viewport?.parentElement ?? element.parentElement
  const parentStyle = parent && getComputedStyle(parent)
  const available =
    parent && parentStyle
      ? parent.clientWidth -
        parseFloat(parentStyle.paddingLeft) -
        parseFloat(parentStyle.paddingRight)
      : width
  const scale = Math.min(1, Math.max(1, available) / width)
  element.style.setProperty("--cv-rich-page-scale", String(scale))
  if (viewport) {
    viewport.style.width = `${width * scale}px`
    viewport.style.height = `${element.offsetHeight * scale}px`
  }
  return scale
}
