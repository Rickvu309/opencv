"use client"

import { css } from "./segmented-control-styles"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"

export type SegmentOption<T extends string = string> = {
  value: T
  label?: ReactNode
  icon?: ReactNode
  count?: number | string
  badge?: ReactNode
  disabled?: boolean
  ariaLabel?: string
  controls?: string
}

export type SegmentedControlProps<T extends string = string> = {
  options: SegmentOption<T>[]
  value?: T
  defaultValue?: T
  onChange?: (value: T) => void
  size?: "sm" | "md" | "lg"
  variant?: "buttons" | "tray" | "underline"
  fullWidth?: boolean
  kind?: "radio" | "tabs"
  disabled?: boolean
  "aria-label"?: string
  "aria-labelledby"?: string
  className?: string
}

function capturePointerIfAllowed(element: HTMLElement, pointerId: number) {
  try {
    element.setPointerCapture(pointerId)
  } catch {
    return
  }
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  defaultValue,
  onChange,
  size = "md",
  variant = "tray",
  fullWidth = false,
  kind = "radio",
  disabled = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  className,
}: SegmentedControlProps<T>) {
  const [inner, setInner] = useState<T | undefined>(
    () => defaultValue ?? options.find((o) => !o.disabled)?.value
  )
  const current = value !== undefined ? value : inner

  const root = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const valueAfterPicksThisFrame = useRef(current)
  // eslint-disable-next-line react-hooks/refs -- vendored: a drag picks several options before the next render
  valueAfterPicksThisFrame.current = current
  const gliding = useRef(false)
  const glideTimer = useRef(0)
  const placed = useRef<T | undefined>(undefined)
  const press = useRef<{
    id: number
    touch: boolean
    drag: boolean
    x: number
    moved: boolean
  } | null>(null)

  const buttons = () =>
    Array.from(
      track.current?.querySelectorAll<HTMLElement>(":scope > .ui-segc__opt") ??
        []
    )
  const activeIndex = options.findIndex((o) => o.value === current)
  const tabbable =
    activeIndex >= 0 ? activeIndex : options.findIndex((o) => !o.disabled)

  const select = (v: T) => {
    const opt = options.find((o) => o.value === v)
    if (
      !opt ||
      opt.disabled ||
      disabled ||
      v === valueAfterPicksThisFrame.current
    )
      return
    valueAfterPicksThisFrame.current = v
    if (value === undefined) setInner(v)
    onChange?.(v)
  }

  const measure = () => {
    const els = buttons()
    if (!els.length || !track.current) return
    const cs = getComputedStyle(els[0])
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    const widths = els.map(
      (b) => (b.firstElementChild as HTMLElement).offsetWidth + pad
    )
    if (fullWidth) {
      track.current.style.setProperty(
        "--ui-segc-min",
        `${Math.max(...widths)}px`
      )
      els.forEach((b) => (b.style.width = ""))
    } else els.forEach((b, i) => (b.style.width = `${widths[i]}px`))
  }

  const place = (animate: boolean) => {
    const t = track.current
    const p = pill.current
    if (!t || !p) return
    const btn = t.querySelector<HTMLElement>(
      ":scope > .ui-segc__opt[data-active]"
    )
    if (!btn || !btn.offsetWidth) {
      p.style.opacity = "0"
      return
    }
    let x = btn.offsetLeft
    let w = btn.offsetWidth
    if (variant === "underline") {
      const content = btn.firstElementChild as HTMLElement
      x += content.offsetLeft
      w = content.offsetWidth
    }
    const instant = !p.dataset.ready || (!animate && !gliding.current)
    const prev = parseFloat(p.style.left) || 0
    if (!instant && x !== prev) p.dataset.dir = x > prev ? "right" : "left"
    if (instant) p.style.transition = "none"
    p.style.opacity = "1"
    p.style.left = `${x}px`
    p.style.right = `${t.clientWidth - x - w}px`
    if (instant) {
      p.dataset.ready = "1"
      void p.offsetWidth
      p.style.transition = ""
    }
  }

  const fades = () => {
    const s = scroller.current
    if (!s) return
    const max = s.scrollWidth - s.clientWidth
    root.current?.toggleAttribute("data-overflow", max > 1)
    s.style.setProperty("--ui-segc-fade-l", s.scrollLeft > 1 ? "24px" : "0px")
    s.style.setProperty(
      "--ui-segc-fade-r",
      s.scrollLeft < max - 1 ? "24px" : "0px"
    )
  }

  const reveal = (smooth: boolean) => {
    const s = scroller.current
    const t = track.current
    const btn = t?.querySelector<HTMLElement>(
      ":scope > .ui-segc__opt[data-active]"
    )
    if (!s || !t || !btn || s.scrollWidth <= s.clientWidth + 1) return
    const left =
      t.offsetLeft + btn.offsetLeft - (s.clientWidth - btn.offsetWidth) / 2
    s.scrollTo({
      left: Math.max(0, left),
      behavior: smooth ? "smooth" : "auto",
    })
  }

  useLayoutEffect(() => {
    const t = track.current
    const s = scroller.current
    if (!t || !s) return
    const sync = () => {
      measure()
      place(false)
      fades()
    }
    sync()
    const ready = requestAnimationFrame(() =>
      root.current?.setAttribute("data-ready", "")
    )
    let frame = 0
    const syncOneFrameLaterSoWidthsSetInsideTheObserverNeverLoopIt = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(sync)
    }
    const ro = new ResizeObserver(
      syncOneFrameLaterSoWidthsSetInsideTheObserverNeverLoopIt
    )
    ro.observe(s)
    ro.observe(t)
    t.querySelectorAll(".ui-segc__opt, .ui-segc__content").forEach((el) =>
      ro.observe(el)
    )
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
      cancelAnimationFrame(ready)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measuring reruns when the options or look change, not when place or measure get new identities
  }, [options.length, fullWidth, variant, size])

  useLayoutEffect(() => {
    if (placed.current === current) return
    const first = placed.current === undefined
    placed.current = current
    if (!first) {
      gliding.current = true
      clearTimeout(glideTimer.current)
      glideTimer.current = window.setTimeout(
        () => (gliding.current = false),
        240
      )
    }
    place(!first)
    reveal(!first)
    const t = track.current
    if (!first && t && t.contains(document.activeElement))
      buttons()[activeIndex]?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the glide runs when the value changes, not when activeIndex or place get new identities
  }, [current])

  useEffect(() => () => clearTimeout(glideTimer.current), [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = options.filter((o) => !o.disabled)
    if (!enabled.length || disabled) return
    const prevKeys = kind === "radio" ? ["ArrowLeft", "ArrowUp"] : ["ArrowLeft"]
    const nextKeys =
      kind === "radio" ? ["ArrowRight", "ArrowDown"] : ["ArrowRight"]
    const at = enabled.findIndex(
      (o) => o.value === valueAfterPicksThisFrame.current
    )
    let target: SegmentOption<T> | undefined
    if (prevKeys.includes(e.key))
      target = enabled[(at - 1 + enabled.length) % enabled.length]
    else if (nextKeys.includes(e.key))
      target = enabled[(at + 1) % enabled.length]
    else if (e.key === "Home") target = enabled[0]
    else if (e.key === "End") target = enabled[enabled.length - 1]
    if (!target) return
    e.preventDefault()
    select(target.value)
    buttons()[options.indexOf(target)]?.focus()
  }

  const optionAt = (clientX: number) => {
    let best = -1
    let dist = Infinity
    buttons().forEach((b, i) => {
      const r = b.getBoundingClientRect()
      const d =
        clientX < r.left
          ? r.left - clientX
          : clientX > r.right
            ? clientX - r.right
            : 0
      if (d < dist) {
        dist = d
        best = i
      }
    })
    return options[best]
  }

  const selectFromKeyboardOrScreenReaderClick = select

  const endPress = () => {
    press.current = null
    root.current?.removeAttribute("data-pressed")
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return
    const opt = optionAt(e.clientX)
    if (!opt || opt.disabled) return
    const touch = e.pointerType === "touch"
    const drag = !touch || opt.value === valueAfterPicksThisFrame.current
    press.current = { id: e.pointerId, touch, drag, x: e.clientX, moved: false }
    if (drag) root.current?.setAttribute("data-pressed", "")
    if (!touch) {
      select(opt.value)
      capturePointerIfAllowed(e.currentTarget, e.pointerId)
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current
    if (!p || p.id !== e.pointerId) return
    if (!p.moved && Math.abs(e.clientX - p.x) < (p.touch ? 8 : 3)) return
    p.moved = true
    if (!p.drag) return
    const opt = optionAt(e.clientX)
    if (opt && !opt.disabled) select(opt.value)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current
    if (!p || p.id !== e.pointerId) return
    if (p.touch && !p.moved) {
      const opt = optionAt(e.clientX)
      if (opt) select(opt.value)
    }
    endPress()
  }

  const isTabs = kind === "tabs"

  return (
    <div
      ref={root}
      data-slot="segmented-control"
      className={["ui-segc", className].filter(Boolean).join(" ")}
      data-size={size}
      data-variant={variant}
      data-full={fullWidth || undefined}
      data-disabled={disabled || undefined}
    >
      <style href="ui-segmented-control-clean" precedence="default">
        {css}
      </style>

      <div ref={scroller} className="ui-segc__scroller" onScroll={fades}>
        <div
          ref={track}
          className="ui-segc__track"
          role={isTabs ? "tablist" : "radiogroup"}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-disabled={disabled || undefined}
          aria-orientation={isTabs ? "horizontal" : undefined}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={endPress}
          onLostPointerCapture={endPress}
        >
          <span ref={pill} className="ui-segc__pill" aria-hidden="true" />
          {options.map((o, i) => {
            const active = i === activeIndex
            return (
              <button
                key={o.value}
                type="button"
                className="ui-segc__opt"
                role={isTabs ? "tab" : "radio"}
                aria-checked={isTabs ? undefined : active}
                aria-selected={isTabs ? active : undefined}
                aria-controls={isTabs ? o.controls : undefined}
                aria-label={o.ariaLabel}
                data-active={active || undefined}
                disabled={o.disabled || disabled}
                tabIndex={i === tabbable ? 0 : -1}
                onClick={() => selectFromKeyboardOrScreenReaderClick(o.value)}
              >
                <span className="ui-segc__content">
                  {o.icon && <span className="ui-segc__icon">{o.icon}</span>}
                  {o.label != null && (
                    <span className="ui-segc__label">{o.label}</span>
                  )}
                  {o.count != null && (
                    <span key={String(o.count)} className="ui-segc__count">
                      {o.count}
                    </span>
                  )}
                  {o.badge != null && (
                    <span className="ui-segc__badge">{o.badge}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
