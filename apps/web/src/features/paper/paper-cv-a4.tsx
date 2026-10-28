import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"

const A4_HEIGHT_FALLBACK_PX = 1123
/** 210mm at 96dpi — JS fallback when the page has not been laid out. */
const A4_WIDTH_FALLBACK_PX = 794

/** Fallback when `--cv-page-height` is unavailable (SSR / tests). */
export const A4_HEIGHT_PX = A4_HEIGHT_FALLBACK_PX
export const A4_WIDTH_PX = A4_WIDTH_FALLBACK_PX
export const A4_WIDTH_MM = 210

/**
 * Fit-width A4 (QVE-208). Never upscales. Available ≤ 0 (jsdom / SSR)
 * keeps the natural page so desktop tests stay at 210mm.
 */
export function readA4FitWidth(availablePx: number, naturalPx: number): number {
  if (!(naturalPx > 0)) return availablePx > 0 ? availablePx : 0
  if (!(availablePx > 0)) return naturalPx
  return Math.min(availablePx, naturalPx)
}

export function readA4FitScale(availablePx: number, naturalPx: number): number {
  const fit = readA4FitWidth(availablePx, naturalPx)
  if (!(naturalPx > 0) || !(fit > 0)) return 1
  return Math.min(1, fit / naturalPx)
}

/** Reads the A4 page height from the CSS variable (single source). */
export function readA4HeightPx(target?: Element | null): number {
  const node =
    target ??
    (typeof document === "undefined" ? null : document.documentElement)
  if (!node) return A4_HEIGHT_FALLBACK_PX
  const raw = getComputedStyle(node).getPropertyValue("--cv-page-height")
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : A4_HEIGHT_FALLBACK_PX
}

type Props = {
  children: ReactNode
  className?: string
  preview?: boolean
}

export function CvA4Canvas({ children, className, preview = false }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(1)
  const [pageHeight, setPageHeight] = useState(A4_HEIGHT_FALLBACK_PX)

  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const node: HTMLDivElement = el
    const page = node.closest(".cv-a4-page")

    function measure() {
      const heightPx = readA4HeightPx(page ?? document.documentElement)
      setPageHeight(heightPx)
      setPageCount(Math.max(1, Math.ceil(node.scrollHeight / heightPx)))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [children])

  const totalHeight = pageCount * pageHeight

  return (
    <div
      data-paper-a4-fit="width"
      className={cn(
        "cv-a4-fit flex w-full justify-center bg-muted/30 px-2 py-8 sm:px-4",
        preview && "cv-a4-preview",
        className
      )}
    >
      <div
        className="cv-a4-page relative border border-border bg-card shadow-sm"
        style={{
          width: preview ? undefined : `${A4_WIDTH_MM}mm`,
          maxWidth: "100%",
          minHeight: pageHeight,
          height: totalHeight,
        }}
      >
        <div ref={contentRef} className="cv-a4-content">
          {children}
        </div>

        {pageCount > 1
          ? Array.from({ length: pageCount - 1 }).map((_, index) => (
              <div
                key={index}
                className="pointer-events-none absolute inset-x-[15mm] border-t border-dashed border-border"
                style={{ top: (index + 1) * pageHeight }}
                aria-hidden
              />
            ))
          : null}
      </div>
    </div>
  )
}
