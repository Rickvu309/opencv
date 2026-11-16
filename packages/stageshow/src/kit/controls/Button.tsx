import {
  useLayoutEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react"
import { Roll } from "../motion/Roll.tsx"
import "./Button.css"

export type ButtonProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "primary" | "secondary" | "tertiary" | "ghost" | "danger"
  size?: "small" | "medium" | "large"
  icon?: ReactNode
  trailingIcon?: ReactNode
}

export function Button({
  variant = "secondary",
  size = "medium",
  icon,
  trailingIcon,
  children,
  className,
  ...rest
}: ButtonProps) {
  const [last, setLast] = useState<ReactNode>(icon)
  const [open, setOpen] = useState(!!icon)
  const has = !!icon
  useLayoutEffect(() => {
    if (!has) return setOpen(false)
    setLast(icon)
    if (open) return
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [has])
  return (
    <span
      role="button"
      data-cursor="pointer"
      {...rest}
      className={`ss-button${className ? ` ${className}` : ""}`}
      data-variant={variant}
      data-size={size}
      data-leading={open ? "" : undefined}
      data-trailing={trailingIcon ? "" : undefined}
    >
      {last != null && (
        <span
          className="ss-button__icon ss-button__lead"
          data-open={open || undefined}
          onTransitionEnd={(e) => {
            if (!has && e.propertyName === "width") setLast(null)
          }}
        >
          {icon ?? last}
        </span>
      )}
      {children != null && children !== false && (
        <span className="ss-button__label">
          {typeof children === "string" || typeof children === "number" ? (
            <Roll variant="fade">{String(children)}</Roll>
          ) : (
            children
          )}
        </span>
      )}
      {trailingIcon && <span className="ss-button__icon">{trailingIcon}</span>}
    </span>
  )
}
