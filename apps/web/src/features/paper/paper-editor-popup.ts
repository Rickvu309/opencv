import { createContext, useCallback, useRef } from "react"
import type {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core"
import { useBlockNoteEditor } from "@blocknote/react"

export type LinkRequest = {
  readonly count: number
  readonly take: () => boolean
}

export const LinkRequestContext = createContext<LinkRequest>({
  count: 0,
  take: () => false,
})

export function useEditorPopupRef() {
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >()
  const registered = useRef<HTMLElement | null>(null)
  return useCallback(
    (element: HTMLElement | null) => {
      if (registered.current) editor.unregisterPortalElement(registered.current)
      registered.current = element
      if (element) editor.registerPortalElement(element)
    },
    [editor]
  )
}
