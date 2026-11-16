import type { CSSProperties, HTMLAttributes } from "react"
import "./Card.css"

export function Card({
  pad = "medium",
  gap = 12,
  tone = "surface",
  lift,
  flush,
  className,
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  pad?: "small" | "medium" | "large"
  gap?: number
  tone?: "surface" | "sunken"
  lift?: boolean
  flush?: boolean
}) {
  return (
    <div
      {...rest}
      className={`ss-card${className ? ` ${className}` : ""}`}
      data-pad={pad}
      data-tone={tone}
      data-lift={lift || undefined}
      data-flush={flush || undefined}
      style={{ ...style, "--ss-card-gap": `${gap}px` } as CSSProperties}
    />
  )
}
