import { readA4HeightPx } from "./paper-cv-a4.tsx"
import "./paper-print.css"

const PRINT_WAIT_MS = 2000
const MEASURE_DEBOUNCE_MS = 50

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

export function bindPrintPageCount(apply: () => void) {
  let cancelled = false
  const run = () => {
    if (!cancelled) apply()
  }
  run()
  const timer = window.setTimeout(run, MEASURE_DEBOUNCE_MS)
  void document.fonts?.ready?.then(() => run())
  return () => {
    cancelled = true
    window.clearTimeout(timer)
  }
}

function isSeparator(text: string) {
  const trimmed = text.trim()
  return trimmed === "·" || trimmed === "|"
}

export function quietPaperChrome(root: ParentNode) {
  const fields = root.querySelectorAll<HTMLElement>("[data-paper-canvas-field]")
  for (const field of fields) {
    field.removeAttribute("data-placeholder")
    if (field.textContent?.trim()) continue
    field.setAttribute("hidden", "")
    const previous = field.previousElementSibling
    if (previous && isSeparator(previous.textContent ?? "")) {
      previous.setAttribute("hidden", "")
    }
  }
}

export function printPaper(title: string | undefined, onDone?: () => void) {
  const root = document.body
  const previousTitle = document.title
  if (title) document.title = title
  root.setAttribute("data-print", "paper")
  let cancelled = false
  let finished = false
  let timer = 0

  const finish = () => {
    if (finished) return
    finished = true
    window.clearTimeout(timer)
    root.removeAttribute("data-print")
    if (title) document.title = previousTitle
    onDone?.()
  }

  const onAfter = () => {
    window.removeEventListener("afterprint", onAfter)
    finish()
  }
  window.addEventListener("afterprint", onAfter)

  const images = [
    ...root.querySelectorAll<HTMLImageElement>("[data-paper-print] img"),
  ]
  const fonts = document.fonts?.ready ?? Promise.resolve()
  const decoded = Promise.all(
    images.map((img) => {
      if (typeof img.decode !== "function") return Promise.resolve()
      return img.decode().catch(() => undefined)
    })
  )
  const bound = new Promise<void>((resolve) => {
    timer = window.setTimeout(resolve, PRINT_WAIT_MS)
  })

  void Promise.race([Promise.all([fonts, decoded]), bound]).then(() => {
    window.clearTimeout(timer)
    if (cancelled || finished) return
    try {
      window.print()
    } catch {
      window.removeEventListener("afterprint", onAfter)
      finish()
    }
  })

  return () => {
    cancelled = true
    window.clearTimeout(timer)
    window.removeEventListener("afterprint", onAfter)
    if (finished) return
    root.removeAttribute("data-print")
    if (title) document.title = previousTitle
  }
}
