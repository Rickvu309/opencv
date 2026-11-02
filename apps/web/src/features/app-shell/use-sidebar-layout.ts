import { useEffect, useReducer, useRef } from "react"

import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  isTypingTarget,
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
      return state.collapsed ? { ...state, peek: action.peek } : state
  }
}

function initialLayout(): LayoutState {
  return {
    width: readSidebarWidth(),
    collapsed: readSidebarCollapsed(),
    peek: false,
  }
}

export function useSidebarLayout(enabled: boolean) {
  const [state, dispatch] = useReducer(layoutReducer, undefined, initialLayout)
  const hover = useRef({ inside: false, menuOpen: false })
  const { collapsed } = state

  function setCollapsed(next: boolean) {
    writeSidebarCollapsed(next)
    dispatch({ type: "collapse_set", collapsed: next })
  }

  useEffect(() => {
    if (!enabled) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "[" || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      writeSidebarCollapsed(!collapsed)
      dispatch({ type: "collapse_set", collapsed: !collapsed })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled, collapsed])

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
    peekEnter: () => {
      hover.current.inside = true
      dispatch({ type: "peek_set", peek: true })
    },
    peekLeave: () => {
      hover.current.inside = false
      if (!hover.current.menuOpen) dispatch({ type: "peek_set", peek: false })
    },
    menuOpenChange: (open: boolean) => {
      hover.current.menuOpen = open
      if (!open && !hover.current.inside) {
        dispatch({ type: "peek_set", peek: false })
      }
    },
  }
}

export type SidebarLayout = ReturnType<typeof useSidebarLayout>
