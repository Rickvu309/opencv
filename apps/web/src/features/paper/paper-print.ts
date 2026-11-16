import { toast } from "sonner"

import { capturePrintReadiness } from "./paper-print-readiness.ts"
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

let cancelActivePrint: (() => void) | undefined

export function printPaper(title: string | undefined, onDone?: () => void) {
  cancelActivePrint?.()
  const root = document.body
  const previousTitle = document.title
  const controller = new AbortController()
  let finished = false
  let timer = 0

  const finish = () => {
    if (finished) return
    finished = true
    window.clearTimeout(timer)
    controller.abort()
    window.removeEventListener("afterprint", finish)
    root.removeAttribute("data-print")
    if (title) document.title = previousTitle
    if (cancelActivePrint === finish) cancelActivePrint = undefined
    onDone?.()
  }
  cancelActivePrint = finish
  if (title) document.title = title
  root.setAttribute("data-print", "paper")
  window.addEventListener("afterprint", finish)

  const refuse = () => {
    if (finished) return
    finish()
    toast.error(
      "Paper could not print. Check that photos and fonts have loaded, then try Download PDF again."
    )
  }
  try {
    const readiness = capturePrintReadiness(controller.signal)
    const deadline = new Promise<never>((_, reject) => {
      timer = window.setTimeout(
        () => reject(new Error("Print readiness timed out")),
        PRINT_WAIT_MS
      )
    })
    void Promise.race([readiness.ready, deadline]).then(() => {
      window.clearTimeout(timer)
      if (finished) return
      if (!readiness.isCurrent()) {
        refuse()
        return
      }
      try {
        window.print()
      } catch {
        refuse()
      }
    }, refuse)
  } catch {
    refuse()
  }
  return finish
}
