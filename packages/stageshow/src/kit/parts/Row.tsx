import type { CSSProperties, HTMLAttributes, ReactNode } from "react"
import { Bar } from "../window.tsx"
import "./Row.css"

export interface RowProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  lead?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  preview?: number[] | ReactNode
  unread?: boolean
  selected?: boolean
  pad?: number
}

export function Row({
  lead,
  title,
  subtitle,
  meta,
  preview,
  unread,
  selected,
  pad = 12,
  className,
  style,
  children,
  ...rest
}: RowProps) {
  return (
    <div
      {...rest}
      className={`ss-row${className ? ` ${className}` : ""}`}
      data-selected={selected || undefined}
      data-unread={unread || undefined}
      data-lead={lead ? "" : undefined}
      style={{ "--ss-row-pad": `${pad}px`, ...style } as CSSProperties}
    >
      {unread && <span className="ss-row__dot" aria-hidden />}
      {lead && <span className="ss-row__lead">{lead}</span>}
      <span className="ss-row__body">
        <span className="ss-row__head">
          <span className="ss-row__title">{title}</span>
          {meta && <span className="ss-row__meta">{meta}</span>}
        </span>
        {subtitle && <span className="ss-row__subtitle">{subtitle}</span>}
      </span>
      {preview &&
        (Array.isArray(preview) &&
        preview.every((w) => typeof w === "number") ? (
          <span className="ss-row__preview" aria-hidden>
            {preview.map((w, i) => (
              <Bar key={i} w={w} h={6} tone={2} />
            ))}
          </span>
        ) : (
          <span className="ss-row__preview" data-text>
            {preview}
          </span>
        ))}
      {children}
    </div>
  )
}
