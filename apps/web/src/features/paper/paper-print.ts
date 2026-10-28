import { readA4HeightPx } from "./paper-cv-a4.tsx"
import "./paper-print.css"

export function pagesFromPreviewHeight(
  contentHeightPx: number,
  pageHeightPx: number
) {
  if (!(contentHeightPx > 0) || !(pageHeightPx > 0)) return 1
  return Math.max(1, Math.ceil(contentHeightPx / pageHeightPx - 1e-9))
}

export function readPreviewPageCount(element: HTMLElement | null) {
  if (!element) return 1
  return pagesFromPreviewHeight(element.scrollHeight, readA4HeightPx(element))
}

export function printPaper(title?: string) {
  const root = document.body
  const previousTitle = document.title
  if (title) document.title = title
  root.setAttribute("data-print", "paper")
  const clear = () => {
    root.removeAttribute("data-print")
    if (title) document.title = previousTitle
  }
  window.addEventListener("afterprint", clear, { once: true })
  window.setTimeout(() => {
    root.getBoundingClientRect()
    try {
      window.print()
    } catch {
      clear()
    }
  }, 0)
}
