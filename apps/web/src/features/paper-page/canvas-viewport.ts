import { scalePaperPage } from "@workspace/paper-viewport"
import { type RefObject, useLayoutEffect } from "react"

export function useCanvasScale(
  pageRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  redraw: number
) {
  useLayoutEffect(() => {
    const page = pageRef.current
    const scroll = scrollRef.current
    if (!page || !scroll) return
    const layout = () => scalePaperPage(page, 816)
    layout()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(layout)
    observer.observe(scroll)
    observer.observe(page)
    return () => observer.disconnect()
  }, [pageRef, scrollRef, redraw])
}

export function revealCaret(page: HTMLElement, scroll: HTMLElement) {
  const node = page.ownerDocument.getSelection()?.focusNode
  const target =
    node?.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as HTMLElement | null)
  if (!target) return
  const caretBox = target.getBoundingClientRect()
  const frame = scroll.getBoundingClientRect()
  if (caretBox.top >= frame.top && caretBox.bottom <= frame.bottom) return
  target.scrollIntoView({ block: "nearest" })
}
