import type { HTMLAttributes } from "react"
import "./Slot.css"

export function Slot({
  open,
  height,
  gap = 0,
  dashed,
  className,
  style,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  open: boolean
  height: number
  gap?: number
  dashed?: boolean
}) {
  return (
    <div
      {...rest}
      className={`ss-slot${className ? ` ${className}` : ""}`}
      data-open={open || undefined}
      data-dashed={dashed || undefined}
      style={{
        height: open ? height : 0,
        marginTop: open ? 0 : -gap,
        ...style,
      }}
    >
      <div className="ss-slot__clip">
        <div className="ss-slot__mark" style={{ height }} />
      </div>
      {children}
    </div>
  )
}
