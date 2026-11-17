import { createContext, type RefObject } from "react"

export const PopupContainerContext =
  createContext<RefObject<HTMLDivElement | null> | null>(null)
