import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react"

import {
  DEMONSTRATION_SECONDS,
  applyKey,
  demonstrationValue,
  type MotionSpec,
} from "./model.ts"

export type FigureRefs = {
  well: RefObject<HTMLDivElement | null>
  live: RefObject<HTMLParagraphElement | null>
}

type FigureMotion = {
  stop: number
  playing: boolean
  canPlay: boolean
  togglePlaying: () => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onFocus: () => void
  onPointerEnter: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
  onPointerLeave: (event: PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void
}

type Drag = {
  id: number
  x: number
  y: number
  moved: boolean
  pointerType: string
}

const STILL_QUERY = "(prefers-reduced-motion: reduce)"
const VISIBLE_RATIO = 0.25

function prefersStill(): boolean {
  return window.matchMedia(STILL_QUERY).matches
}

export function useFigureMotion(
  spec: MotionSpec,
  readoutOf: (value: number) => string,
  apply: (value: number) => void,
  refs: FigureRefs
): FigureMotion {
  const latest = useRef({ readoutOf, apply, spec, refs })
  const [stop, setStop] = useState(spec.min)
  const [playing, setPlaying] = useState(false)
  const [canPlay, setCanPlay] = useState(false)
  const api = useRef<Omit<FigureMotion, "stop" | "playing" | "canPlay"> | null>(
    null
  )

  useEffect(() => {
    latest.current = { readoutOf, apply, spec, refs }
  })

  useEffect(() => {
    const state = {
      value: spec.min,
      target: spec.min,
      published: spec.min,
      demonstrating: false,
      suspended: false,
      demoStarted: false,
      demoClock: 0,
      interacted: false,
      visible: false,
    }
    let frame = 0
    let last = 0
    let announceTimer = 0
    let drag: Drag | null = null

    const currentSpec = () => latest.current.spec
    const paint = () => {
      latest.current.apply(state.value)
    }
    const needsFrame = () => state.demonstrating || state.value !== state.target
    const kick = () => {
      if (frame || !state.visible || !needsFrame()) return
      last = 0
      frame = window.requestAnimationFrame(tick)
    }
    const announceUnlessSliderFocused = (text: string) => {
      window.clearTimeout(announceTimer)
      if (document.activeElement === latest.current.refs.well.current) return
      announceTimer = window.setTimeout(() => {
        const node = latest.current.refs.live.current
        if (node) node.textContent = text
      }, 0)
    }
    const publish = (value: number) => {
      const changed = state.published !== value
      state.published = value
      if (changed) setStop(value)
      announceUnlessSliderFocused(latest.current.readoutOf(value))
    }
    const setDemonstrating = (on: boolean) => {
      state.demonstrating = on
      setPlaying(on)
    }
    const disarm = () => {
      state.interacted = true
      state.suspended = false
      setDemonstrating(false)
    }
    const suspend = () => {
      if (!state.demonstrating) return
      state.demonstrating = false
      state.suspended = true
      state.target = state.value
    }
    const resume = () => {
      if (!state.suspended) return
      state.suspended = false
      state.demonstrating = true
      kick()
    }
    const valueFromX = (clientX: number) => {
      const bounds = currentSpec()
      const well = latest.current.refs.well.current
      if (!well) return bounds.min
      const rect = well.getBoundingClientRect()
      const width = rect.width || 1
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / width))
      return bounds.min + ratio * (bounds.max - bounds.min)
    }
    const nearest = (value: number) => {
      const bounds = currentSpec()
      const steps = Math.round((value - bounds.min) / bounds.step)
      return Math.min(
        bounds.max,
        Math.max(bounds.min, bounds.min + steps * bounds.step)
      )
    }
    const commit = (value: number) => {
      const bounds = currentSpec()
      const next = Math.min(bounds.max, Math.max(bounds.min, value))
      disarm()
      state.target = next
      publish(next)
      kick()
    }
    const beginDemo = () => {
      if (state.demoStarted || state.interacted || !state.visible) return
      state.demoStarted = true
      if (prefersStill()) return
      state.demoClock = 0
      setDemonstrating(true)
      kick()
    }
    function tick(now: number) {
      if (!state.visible) {
        frame = 0
        return
      }
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60
      last = now
      const calm = prefersStill()
      if (state.demonstrating) {
        if (calm || state.interacted) {
          setDemonstrating(false)
          state.target = state.published
          if (calm) state.value = state.published
        } else {
          state.demoClock = (state.demoClock + dt) % DEMONSTRATION_SECONDS
          const bounds = currentSpec()
          const shown = demonstrationValue(
            bounds.min,
            bounds.max,
            state.demoClock
          )
          state.value += (shown - state.value) * (1 - Math.exp(-dt / 0.22))
          state.target = shown
        }
      }
      if (!state.demonstrating) {
        state.value = calm
          ? state.target
          : state.value +
            (state.target - state.value) * (1 - Math.exp(-dt / 0.22))
        if (Math.abs(state.value - state.target) < 0.0008)
          state.value = state.target
      }
      paint()
      frame = needsFrame() ? window.requestAnimationFrame(tick) : 0
    }
    const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
      const well = latest.current.refs.well.current
      if (well?.hasPointerCapture(event.pointerId))
        well.releasePointerCapture(event.pointerId)
    }

    api.current = {
      onFocus: () => {
        if (drag) return
        const touring = state.demonstrating
        disarm()
        if (touring || state.value !== state.published) {
          state.target = state.published
          kick()
        }
      },
      onKeyDown: (event) => {
        const next = applyKey(
          state.published,
          event.key,
          currentSpec(),
          event.shiftKey
        )
        if (next === null) return
        event.preventDefault()
        commit(next)
      },
      onPointerEnter: (event) => {
        if (event.pointerType === "touch") return
        suspend()
      },
      onPointerMove: (event) => {
        if (drag && drag.id === event.pointerId) {
          if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5)
            drag.moved = true
          state.target = valueFromX(event.clientX)
          kick()
          return
        }
        if (drag || event.pointerType === "touch") return
        suspend()
        state.target = nearest(valueFromX(event.clientX))
        kick()
      },
      onPointerDown: (event) => {
        if (event.button !== 0) return
        if (event.pointerType === "touch") suspend()
        else disarm()
        drag = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          moved: false,
          pointerType: event.pointerType,
        }
        latest.current.refs.well.current?.setPointerCapture(event.pointerId)
      },
      onPointerUp: (event) => {
        if (!drag || drag.id !== event.pointerId) return
        const tapped = !drag.moved && drag.pointerType !== "mouse"
        const bounds = currentSpec()
        const next = tapped
          ? Math.min(bounds.max, state.published + bounds.step)
          : nearest(valueFromX(event.clientX))
        drag = null
        releasePointer(event)
        commit(next)
      },
      onPointerCancel: (event) => {
        drag = null
        releasePointer(event)
        state.target = state.published
        if (state.suspended) resume()
        else {
          disarm()
          kick()
        }
      },
      onPointerLeave: () => {
        if (drag) return
        state.target = state.published
        if (state.suspended) resume()
        else kick()
      },
      togglePlaying: () => {
        if (state.demonstrating || state.suspended) {
          disarm()
          state.target = state.published
          kick()
          return
        }
        state.interacted = false
        state.demoStarted = true
        state.demoClock = 0
        state.target = state.published
        setDemonstrating(true)
        kick()
      },
    }

    const well = latest.current.refs.well.current
    if (!well) return
    let observer: IntersectionObserver | null = null
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1]
          state.visible = (entry?.intersectionRatio ?? 0) >= VISIBLE_RATIO
          if (!state.visible) {
            if (frame) window.cancelAnimationFrame(frame)
            frame = 0
            last = 0
            return
          }
          beginDemo()
          paint()
          kick()
        },
        { threshold: VISIBLE_RATIO }
      )
      observer.observe(well)
    } else {
      state.visible = true
      beginDemo()
      paint()
      kick()
    }
    return () => {
      observer?.disconnect()
      window.clearTimeout(announceTimer)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [spec.min])

  useEffect(() => {
    const query = window.matchMedia(STILL_QUERY)
    const sync = () => setCanPlay(!query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  return {
    stop,
    playing,
    canPlay,
    togglePlaying: () => api.current?.togglePlaying(),
    onKeyDown: (event) => api.current?.onKeyDown(event),
    onFocus: () => api.current?.onFocus(),
    onPointerEnter: (event) => api.current?.onPointerEnter(event),
    onPointerMove: (event) => api.current?.onPointerMove(event),
    onPointerDown: (event) => api.current?.onPointerDown(event),
    onPointerUp: (event) => api.current?.onPointerUp(event),
    onPointerLeave: (event) => api.current?.onPointerLeave(event),
    onPointerCancel: (event) => api.current?.onPointerCancel(event),
  }
}
