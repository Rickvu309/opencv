import type { HTMLAttributes } from "react"
import "./Draft.css"

export interface DraftProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  value: string
  full?: string
  editing: boolean
  placeholder?: string
}

export function Draft({
  value,
  full,
  editing,
  placeholder,
  className,
  ...rest
}: DraftProps) {
  return (
    <div
      {...rest}
      className={`ss-draft${className ? ` ${className}` : ""}`}
      data-editing={editing || undefined}
      data-empty={!value || undefined}
    >
      <span className="ss-draft__box">
        <span className="ss-draft__words">
          {full != null && (
            <span className="ss-draft__size" aria-hidden>
              {full}
            </span>
          )}
          <span className="ss-draft__typed">
            {value}
            {editing && <span key={value.length} className="ss-draft__caret" />}
          </span>
          {placeholder && (
            <span className="ss-draft__ph" aria-hidden>
              {placeholder}
            </span>
          )}
        </span>
      </span>
    </div>
  )
}
