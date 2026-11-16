import type { FlowDocument } from "@workspace/domain/internal/paper-presentation"

export function richPageLayout(element: HTMLElement, document: FlowDocument) {
  const page = document.presentation.page
  const width = page.width / 15
  const height = page.height / 15
  const parent = element.parentElement
  const parentStyle = parent && getComputedStyle(parent)
  const available =
    parent && parentStyle
      ? parent.clientWidth -
        parseFloat(parentStyle.paddingLeft) -
        parseFloat(parentStyle.paddingRight)
      : width
  const scale = Math.min(1, available / width)
  element.style.setProperty("--cv-rich-page-width", `${width}px`)
  element.style.setProperty("--cv-rich-page-height", `${height}px`)
  element.style.setProperty("--cv-rich-page-pitch", `${height + 24}px`)
  element.style.setProperty("--cv-rich-page-scale", String(scale))
  for (const key of ["top", "bottom", "start", "end"] as const)
    element.style.setProperty(`--cv-rich-page-${key}`, `${page[key] / 15}px`)
  const top = element.getBoundingClientRect().top + (page.top / 15) * scale
  const pitch = height + 24
  const breaks = new Map<string, number>()
  for (const section of document.flow.children) {
    for (const node of section.children) {
      if (node.type !== "pageBreak") continue
      const block = element.querySelector<HTMLElement>(
        `[data-node-type=blockOuter][data-id="${CSS.escape(node.id)}"]`
      )
      if (!block) continue
      const offset = (block.getBoundingClientRect().top - top) / scale
      const remainder = ((offset % pitch) + pitch) % pitch
      breaks.set(node.id, pitch - remainder)
    }
  }
  const content = element.querySelector<HTMLElement>(":scope > .bn-block-group")
  const bottom = content
    ? (content.getBoundingClientRect().bottom -
        element.getBoundingClientRect().top) /
        scale +
      page.bottom / 15
    : height
  const pages = Math.max(1, Math.ceil((bottom + 24 - 0.5) / pitch))
  element.style.minHeight = `${pages * pitch - 24}px`
  return breaks
}
