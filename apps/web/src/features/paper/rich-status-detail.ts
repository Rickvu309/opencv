import { useLayoutEffect, useRef, useState } from "react"

export function useRichStatusDetail(label: string, saved: boolean) {
  const statusRef = useRef<HTMLSpanElement>(null)
  const detailRef = useRef<HTMLParagraphElement>(null)
  const [visible, setVisible] = useState(false)
  const [minHeight, setMinHeight] = useState(0)

  useLayoutEffect(() => {
    const status = statusRef.current
    if (!status) return
    const measure = () => {
      if (saved) {
        setVisible(false)
        setMinHeight(0)
      } else if (status.scrollWidth > status.clientWidth) {
        setVisible(true)
      }
      const detail = detailRef.current
      if (!saved && detail)
        setMinHeight((height) =>
          Math.max(height, detail.getBoundingClientRect().height)
        )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(status)
    return () => observer.disconnect()
  }, [label, saved, visible])

  return { statusRef, detailRef, visible, minHeight }
}
