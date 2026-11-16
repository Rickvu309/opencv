import {
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react"
import "./Collapse.css"

export function Collapse({
  open,
  reveal = "clip",
  from = "above",
  solid = false,
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  open: boolean
  reveal?: "clip" | "drop"
  from?: "above" | "below"
  solid?: boolean
  children: ReactNode
}) {
  const [moving, setMoving] = useState(false)
  const [tall, setTall] = useState(false)
  const inner = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const held = useRef<ReactNode>(children)
  const [released, setReleased] = useState(true)
  if (open) held.current = children
  useLayoutEffect(() => {
    const h = inner.current?.scrollHeight ?? 0
    if (h) setTall(h > 44)
    if (first.current) return void (first.current = false)
    setMoving(true)
    if (!open) setReleased(false)
    const t = setTimeout(() => {
      setMoving(false)
      setReleased(true)
    }, 900)
    return () => clearTimeout(t)
  }, [open])
  return (
    <div
      {...rest}
      className={`ss-collapse${className ? ` ${className}` : ""}`}
      data-open={open || undefined}
      data-reveal={reveal}
      data-solid={solid || undefined}
      data-from={reveal === "drop" ? from : undefined}
      data-moving={moving || undefined}
      data-tall={tall || undefined}
      onTransitionEnd={(e) => {
        if (
          e.target === e.currentTarget &&
          e.propertyName === "grid-template-rows"
        ) {
          setMoving(false)
          setReleased(true)
        }
        rest.onTransitionEnd?.(e)
      }}
    >
      <div
        ref={inner}
        className="ss-collapse__inner"
        data-crop={reveal === "clip" || undefined}
      >
        {reveal === "drop" ? (
          <div className="ss-collapse__glide">
            {open || released ? children : held.current}
          </div>
        ) : open || released ? (
          children
        ) : (
          held.current
        )}
      </div>
    </div>
  )
}
