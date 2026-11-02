import { createContext, useContext } from "react"

export type SidebarExpand = { collapsed: boolean; expand: () => void }

const NONE: SidebarExpand = { collapsed: false, expand: () => {} }

export const SidebarExpandContext = createContext<SidebarExpand>(NONE)

export function useSidebarExpand() {
  return useContext(SidebarExpandContext)
}
