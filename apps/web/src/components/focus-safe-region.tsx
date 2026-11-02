import { useLayoutEffect, useRef } from "react"
import type { ComponentProps } from "react"

type Props = ComponentProps<"div"> & {
  as?: "div" | "aside" | "nav" | "section"
  concealed: boolean
  focusFallback: () => HTMLElement | null
}

export function FocusSafeRegion({
  as: Tag = "div",
  concealed,
  focusFallback,
  ...props
}: Props) {
  const region = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = region.current
    if (!element) return
    if (concealed && element.contains(document.activeElement)) {
      focusFallback()?.focus()
    }
    element.toggleAttribute("inert", concealed)
  }, [concealed, focusFallback])

  return <Tag {...props} ref={region} />
}
