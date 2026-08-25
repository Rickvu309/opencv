import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"

/** A4 height at 96 CSS dpi (297mm) */
export const A4_HEIGHT_PX = 1123

type Props = {
  children: ReactNode
  className?: string
}

export function CvA4Canvas({ children, className }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(1)

  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const node: HTMLDivElement = el

    function measure() {
      const height = node.scrollHeight
      setPageCount(Math.max(1, Math.ceil(height / A4_HEIGHT_PX)))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [children])

  const totalHeight = pageCount * A4_HEIGHT_PX

  return (
    <div
      className={cn(
        "flex w-full justify-center bg-muted/30 px-2 py-8 sm:px-4",
        className
      )}
    >
      <div
        className="cv-a4-page relative border border-border bg-card shadow-sm"
        style={{
          width: "210mm",
          maxWidth: "100%",
          minHeight: A4_HEIGHT_PX,
          height: totalHeight,
          // Keep CSS variables in sync with measured page height
          ["--cv-page-height" as string]: `${A4_HEIGHT_PX}px`,
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
                style={{ top: (index + 1) * A4_HEIGHT_PX }}
                aria-hidden
              />
            ))
          : null}
      </div>
    </div>
  )
}
