import { useCallback, useEffect, useReducer, useRef } from "react"

import {
  focusIsInSidebar,
  focusMain,
  focusNeedsHandoff,
  focusSidebarToggle,
} from "@/features/app-shell/sidebar-focus.ts"
import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  isTypingTarget,
  PEEK_CLOSE_GRACE_MS,
  PEEK_OPEN_DELAY_MS,
  readSidebarCollapsed,
  readSidebarWidth,
  writeSidebarCollapsed,
  writeSidebarWidth,
} from "@/features/app-shell/sidebar-width.ts"

type LayoutState = { width: number; collapsed: boolean; peek: boolean }

type LayoutAction =
  | { type: "resized"; width: number }
  | { type: "collapse_set"; collapsed: boolean }
  | { type: "peek_set"; peek: boolean }

function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case "resized":
      return { ...state, width: clampSidebarWidth(action.width) }
    case "collapse_set":
      return { ...state, collapsed: action.collapsed, peek: false }
    case "peek_set":
      if (!state.collapsed || state.peek === action.peek) return state
      return { ...state, peek: action.peek }
  }
}

function initialLayout(): LayoutState {
  return {
    width: readSidebarWidth(),
    collapsed: readSidebarCollapsed(),
    peek: false,
  }
}

type Timer = ReturnType<typeof setTimeout> | null

export function useSidebarLayout(enabled: boolean) {
  const [state, dispatch] = useReducer(layoutReducer, undefined, initialLayout)
  const hover = useRef({ inside: false, menuOpen: false })
  const timers = useRef<{ open: Timer; close: Timer }>({
    open: null,
    close: null,
  })
  const handoff = useRef(false)
  const { collapsed, peek } = state

  const clearTimer = useCallback((which: "open" | "close") => {
    const pending = timers.current[which]
    if (pending !== null) clearTimeout(pending)
    timers.current[which] = null
  }, [])

  const setCollapsed = useCallback(
    (next: boolean) => {
      handoff.current = focusNeedsHandoff()
      clearTimer("open")
      clearTimer("close")
      writeSidebarCollapsed(next)
      dispatch({ type: "collapse_set", collapsed: next })
    },
    [clearTimer]
  )

  const closePeek = useCallback(() => {
    clearTimer("open")
    clearTimer("close")
    dispatch({ type: "peek_set", peek: false })
  }, [clearTimer])

  const scheduleClose = useCallback(() => {
    clearTimer("close")
    timers.current.close = setTimeout(() => {
      timers.current.close = null
      dispatch({ type: "peek_set", peek: false })
    }, PEEK_CLOSE_GRACE_MS)
  }, [clearTimer])

  useEffect(() => {
    if (!handoff.current) return
    handoff.current = false
    focusSidebarToggle(collapsed ? "expand" : "collapse")
  }, [collapsed])

  useEffect(() => {
    return () => {
      clearTimer("open")
      clearTimer("close")
    }
  }, [clearTimer])

  useEffect(() => {
    if (!enabled) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "[" || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.repeat || event.isComposing) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      setCollapsed(!collapsed)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled, collapsed, setCollapsed])

  useEffect(() => {
    if (!peek) return
    function dismiss() {
      closePeek()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return
      if (hover.current.menuOpen) return
      if (focusIsInSidebar()) focusSidebarToggle("expand")
      closePeek()
    }
    function onPointerDown(event: PointerEvent) {
      if (hover.current.menuOpen) return
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('[data-slot="sidebar-frame"]')
      ) {
        return
      }
      closePeek()
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") closePeek()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("blur", dismiss)
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("visibilitychange", onVisibility)
    document.documentElement.addEventListener("pointerleave", dismiss)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("blur", dismiss)
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("visibilitychange", onVisibility)
      document.documentElement.removeEventListener("pointerleave", dismiss)
    }
  }, [peek, closePeek])

  return {
    ...state,
    toggle: () => setCollapsed(!collapsed),
    collapse: () => setCollapsed(true),
    pin: () => setCollapsed(false),
    setWidth: (width: number) => {
      const next = clampSidebarWidth(width)
      writeSidebarWidth(next)
      dispatch({ type: "resized", width: next })
    },
    resetWidth: () => {
      writeSidebarWidth(DEFAULT_SIDEBAR_WIDTH)
      dispatch({ type: "resized", width: DEFAULT_SIDEBAR_WIDTH })
    },
    peekHold: () => {
      hover.current.inside = true
      clearTimer("close")
    },
    peekCancel: () => clearTimer("open"),
    peekEnter: () => {
      if (!collapsed || peek || timers.current.open !== null) return
      timers.current.open = setTimeout(() => {
        timers.current.open = null
        dispatch({ type: "peek_set", peek: true })
      }, PEEK_OPEN_DELAY_MS)
    },
    peekLeave: () => {
      hover.current.inside = false
      clearTimer("open")
      if (!peek || hover.current.menuOpen) return
      scheduleClose()
    },
    peekClose: () => {
      if (!peek) return
      if (focusIsInSidebar()) focusMain()
      closePeek()
    },
    menuOpenChange: (open: boolean) => {
      hover.current.menuOpen = open
      if (!open && !hover.current.inside && peek) scheduleClose()
    },
  }
}

export type SidebarLayout = ReturnType<typeof useSidebarLayout>
