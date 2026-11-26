import {
  useEffect,
  useLayoutEffect,
  useRef,
  useReducer,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { useQueryClient } from "@tanstack/react-query"
import { List, MoreHorizontal, Sparkles } from "lucide-react"
import { parsePaperId } from "@workspace/domain/kernel"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { toast } from "sonner"
import { createChat } from "@/features/coach/chat-api.ts"
import { useChatStore } from "@/features/coach/use-chat-store.ts"
import { publishCoachDraft } from "@/lib/coach-draft.ts"
import { useShortcut } from "@/lib/use-shortcut.ts"
import { RichTextEmphasisGroup } from "./rich-text-emphasis-group.tsx"
import { RichStructureControls } from "./rich-structure-controls.tsx"
import type {
  TextEditor,
  TextFormatting,
} from "./rich-text-toolbar-control.tsx"
import "./rich-selection-bubble.css"

type SelectionBox = { left: number; top: number; bottom: number; text: string }

export function RichSelectionBubble({
  editor,
  root,
  blocked,
  docId,
  name,
  onMore,
}: {
  editor: TextEditor | null
  root: RefObject<HTMLDivElement | null>
  blocked: boolean
  docId: string
  name: string
  onMore?: () => void
}) {
  const [selection, setSelection] = useReducer(
    (_: SelectionBox | null, next: SelectionBox | null) => next,
    null
  )
  const [formatting, setFormatting] = useReducer(
    (_: TextFormatting | null, next: TextFormatting | null) => next,
    editor?.activeFormatting() ?? null
  )
  const bubble = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useReducer(
    (
      previous: { left: number; top: number },
      next: { left: number; top: number }
    ) =>
      previous.left === next.left && previous.top === next.top
        ? previous
        : next,
    { left: 8, top: 8 }
  )
  const queryClient = useQueryClient()
  const { openChat } = useChatStore()
  useShortcut({
    key: "Escape",
    enabled: !!selection,
    inFields: true,
    capture: true,
    stop: true,
    prevent: false,
    onPress: () => setSelection(null),
  })
  useLayoutEffect(() => {
    const element = bubble.current
    if (!selection || !element || blocked) return
    const measure = () => {
      const width = element.offsetWidth
      const height = element.offsetHeight
      setPosition({
        left: Math.max(
          8,
          Math.min(selection.left - width / 2, window.innerWidth - width - 8)
        ),
        top: Math.max(
          8,
          Math.min(selection.top - height - 10, window.innerHeight - height - 8)
        ),
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [selection, editor, blocked])
  useEffect(() => {
    const read = () => {
      const selected = document.getSelection()
      const within =
        root.current?.contains(selected?.anchorNode ?? null) &&
        root.current?.contains(selected?.focusNode ?? null)
      if (
        within &&
        selected &&
        !selected.isCollapsed &&
        selected.toString().trim()
      ) {
        const box = selected.getRangeAt(0).getBoundingClientRect()
        setSelection({
          left: box.left + box.width / 2,
          top: box.top,
          bottom: box.bottom,
          text: selected.toString(),
        })
      } else if (
        !document.activeElement?.closest(
          "[data-paper-selection-control], [role~=dialog], [role='listbox']"
        )
      )
        setSelection(null)
      setFormatting(editor?.activeFormatting() ?? null)
    }
    const blur = (event: FocusEvent) => {
      if (
        event.target instanceof Element &&
        !root.current?.contains(event.target) &&
        !event.target.closest(
          "[data-paper-selection-control], [role~=dialog], [role='listbox']"
        )
      )
        setSelection(null)
    }
    const windowBlur = () => setSelection(null)
    const unsubscribe = editor?.subscribe(read)
    document.addEventListener("selectionchange", read)
    document.addEventListener("focusin", blur)
    window.addEventListener("blur", windowBlur)
    window.addEventListener("resize", read)
    window.addEventListener("scroll", read, true)
    return () => {
      unsubscribe?.()
      document.removeEventListener("selectionchange", read)
      document.removeEventListener("focusin", blur)
      window.removeEventListener("blur", windowBlur)
      window.removeEventListener("resize", read)
      window.removeEventListener("scroll", read, true)
    }
  }, [editor, root])
  if (!selection || !editor || blocked) return null
  const ask = () => {
    void createChat(queryClient, {
      title: `About ${name}`,
      focusDocId: parsePaperId(docId),
    })
      .then((chat) => {
        openChat(chat.id)
        publishCoachDraft(selection.text)
        document.querySelector<HTMLButtonElement>("[data-dock-coach]")?.click()
        setSelection(null)
      })
      .catch(() =>
        toast.error("Could not open Coach. Use the dock Coach button.")
      )
  }
  return createPortal(
    <TooltipProvider>
      <div
        ref={bubble}
        role="toolbar"
        aria-label="Selection formatting"
        data-paper-selection-control=""
        className="paper-selection-bubble motion-pop"
        style={position}
        onMouseDown={(event) => event.preventDefault()}
      >
        <RichStructureControls editor={editor} blocked={blocked} compact>
          {({ style, link, lists }) => (
            <>
              {style}
              <RichTextEmphasisGroup
                editor={editor}
                formatting={formatting}
                disabled={!formatting?.hasText}
                all
              />
              {link}
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0 md:size-8"
                      aria-label="Lists"
                    >
                      <List />
                    </Button>
                  }
                />
                <PopoverContent
                  data-paper-selection-control=""
                  className="w-auto motion-pop flex-row"
                  finalFocus={() => {
                    editor.apply()
                    return null
                  }}
                >
                  {lists}
                </PopoverContent>
              </Popover>
            </>
          )}
        </RichStructureControls>
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <Button
          size="touch"
          variant="ghost"
          className="shrink-0 gap-1.5 px-2 text-xs"
          onClick={ask}
        >
          <Sparkles className="size-3.5" />
          Ask Coach
        </Button>
        {onMore ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 md:size-8"
            aria-label="More formatting"
            onClick={onMore}
          >
            <MoreHorizontal />
          </Button>
        ) : null}
      </div>
    </TooltipProvider>,
    document.body
  )
}
