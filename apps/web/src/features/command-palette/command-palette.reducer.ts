import type {
  PaletteChat,
  PaletteScope,
  SearchHits,
} from "@/features/command-palette/palette-search.ts"

export type PaletteState = {
  query: string
  scope: PaletteScope
  activeId: string | null
  hits: SearchHits | null
  recent: PaletteChat[]
  failed: boolean
  wasOpen: boolean
}

export type PaletteAction =
  | { type: "opened" }
  | { type: "closed" }
  | { type: "query_typed"; value: string }
  | { type: "scope_chosen"; scope: PaletteScope }
  | { type: "row_focused"; id: string }
  | { type: "recent_loaded"; chats: PaletteChat[] }
  | { type: "search_succeeded"; hits: SearchHits }
  | { type: "search_failed" }

export function initialPaletteState(open: boolean): PaletteState {
  return {
    query: "",
    scope: "all",
    activeId: null,
    hits: null,
    recent: [],
    failed: false,
    wasOpen: open,
  }
}

export function paletteReducer(
  state: PaletteState,
  action: PaletteAction
): PaletteState {
  switch (action.type) {
    case "opened":
      return {
        ...state,
        wasOpen: true,
        query: "",
        scope: "all",
        activeId: null,
        hits: null,
        failed: false,
      }
    case "closed":
      return { ...state, wasOpen: false }
    case "query_typed":
      return action.value.trim()
        ? { ...state, query: action.value, failed: false }
        : { ...state, query: action.value, hits: null }
    case "scope_chosen":
      return { ...state, scope: action.scope }
    case "row_focused":
      return { ...state, activeId: action.id }
    case "recent_loaded":
      return { ...state, recent: action.chats }
    case "search_succeeded":
      return { ...state, hits: action.hits, failed: false }
    case "search_failed":
      return { ...state, failed: true }
  }
}
