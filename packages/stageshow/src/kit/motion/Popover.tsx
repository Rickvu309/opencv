import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react"
import "./Popover.css"

export type PopoverOrigin =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "center"
  | `${"top" | "bottom" | "center"} ${"left" | "right" | "center"}`
  | `${"left" | "right"} center`

export function Popover({
  show,
  origin = "top left",
  className,
  style,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { show: boolean; origin?: PopoverOrigin }) {
  const held = useRef<{
    style?: CSSProperties
    children: ReactNode
    origin: PopoverOrigin
  } | null>(null)
  const [released, setReleased] = useState(false)
  useEffect(() => {
    if (show) return setReleased(false)
    const t = setTimeout(() => setReleased(true), 320)
    return () => clearTimeout(t)
  }, [show])
  if (show) held.current = { style, children, origin }
  const shown =
    show || released || !held.current
      ? { style, children, origin }
      : held.current
  return (
    <div
      {...rest}
      className={`ss-popover${className ? ` ${className}` : ""}`}
      data-show={show || undefined}
      data-instant={(!show && released) || undefined}
      style={{
        ["--ss-popover-origin" as string]: shown.origin,
        ...shown.style,
      }}
    >
      {shown.children}
    </div>
  )
}
