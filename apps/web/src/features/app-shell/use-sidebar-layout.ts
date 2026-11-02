import type { PointerEvent as ReactPointerEvent } from "react"
import { useCallback, useEffect, useReducer, useRef } from "react"

import { useHoverIntent } from "@/lib/use-hover-intent.ts"
import {
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

export type SidebarMode = "expanded" | "dragging" | "collapsed" | "peeking"

type LayoutState = { width: number; collapsed: boolean; dragging: boolean }

type LayoutAction =
  | { type: "resized"; width: number }
  | { type: "collapse_requested"; collapsed: boolean }
  | { type: "drag_started" }
  | { type: "drag_cancelled" }
  | { type: "drag_collapsed" }

function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case "resized":
      return {
        ...state,
        dragging: false,
        width: clampSidebarWidth(action.width),
      }
    case "collapse_requested":
      if (state.dragging) return state
      return { ...state, collapsed: action.collapsed }
    case "drag_started":
      if (state.collapsed) return state
      return { ...state, dragging: true }
    case "drag_cancelled":
      return { ...state, dragging: false }
    case "drag_collapsed":
      return { ...state, dragging: false, collapsed: true }
  }
}

function initialLayout(): LayoutState {
  return {
    width: readSidebarWidth(),
    collapsed: readSidebarCollapsed(),
    dragging: false,
  }
}

export function useSidebarLayout(enabled: boolean) {
  const [state, dispatch] = useReducer(layoutReducer, undefined, initialLayout)
  const intent = useHoverIntent({
    openDelay: PEEK_OPEN_DELAY_MS,
    closeDelay: PEEK_CLOSE_GRACE_MS,
  })
  const menuOpen = useRef(false)
  const inside = useRef(false)
  const onEdge = useRef(false)
  const handoff = useRef(false)
  const { collapsed, dragging } = state
  const peek = collapsed && !dragging && intent.open
  const mode: SidebarMode = dragging
    ? "dragging"
    : peek
      ? "peeking"
      : collapsed
        ? "collapsed"
        : "expanded"
  const { close: closeIntent } = intent

  const setCollapsed = useCallback(
    (next: boolean) => {
      if (dragging) return
      handoff.current = focusNeedsHandoff()
      closeIntent()
      writeSidebarCollapsed(next)
      dispatch({ type: "collapse_requested", collapsed: next })
    },
    [closeIntent, dragging]
  )

  const dragCollapse = useCallback(() => {
    handoff.current = focusNeedsHandoff()
    closeIntent()
    writeSidebarCollapsed(true)
    dispatch({ type: "drag_collapsed" })
  }, [closeIntent])

  const dragStart = useCallback(() => dispatch({ type: "drag_started" }), [])
  const dragCancel = useCallback(() => dispatch({ type: "drag_cancelled" }), [])

  useEffect(() => {
    if (!handoff.current) return
    handoff.current = false
    focusSidebarToggle(collapsed ? "expand" : "collapse")
  }, [collapsed])

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

  const { contentProps: hoverContent } = intent
  useEffect(() => {
    if (!peek || !onEdge.current) return
    hoverContent.onPointerEnter({ pointerType: "mouse" } as ReactPointerEvent)
  }, [peek, hoverContent])

  useEffect(() => {
    if (!peek) return
    function dismiss() {
      closeIntent()
    }
    function onPointerDown(event: PointerEvent) {
      if (menuOpen.current) return
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('[data-slot="sidebar-frame"]')
      ) {
        return
      }
      closeIntent()
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") closeIntent()
    }
    window.addEventListener("blur", dismiss)
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("visibilitychange", onVisibility)
    document.documentElement.addEventListener("pointerleave", dismiss)
    return () => {
      window.removeEventListener("blur", dismiss)
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("visibilitychange", onVisibility)
      document.documentElement.removeEventListener("pointerleave", dismiss)
    }
  }, [peek, closeIntent])

  const triggerProps = {
    onPointerEnter: (event: ReactPointerEvent) => {
      onEdge.current = true
      if (collapsed) intent.triggerProps.onPointerEnter(event)
    },
    onPointerLeave: (event: ReactPointerEvent) => {
      onEdge.current = false
      if (!menuOpen.current) intent.triggerProps.onPointerLeave(event)
    },
  }

  const contentProps = {
    onPointerEnter: (event: ReactPointerEvent) => {
      inside.current = true
      intent.contentProps.onPointerEnter(event)
    },
    onPointerLeave: (event: ReactPointerEvent) => {
      inside.current = false
      if (!menuOpen.current) intent.contentProps.onPointerLeave(event)
    },
  }

  return {
    width: state.width,
    collapsed,
    mode,
    peek,
    toggle: () => setCollapsed(!collapsed),
    dragStart,
    dragCancel,
    dragCollapse,
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
    triggerProps,
    contentProps,
    peekClose: closeIntent,
    menuOpenChange: (open: boolean) => {
      menuOpen.current = open
      if (!open && !inside.current) closeIntent()
    },
  }
}

export type SidebarLayout = ReturnType<typeof useSidebarLayout>
