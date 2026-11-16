import { useEffect, useReducer, useRef, type ReactNode } from "react"
import { Ellipsis } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from "@workspace/ui/components/popover"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { RichDocumentHistory } from "./rich-document-toolbar.tsx"
import { RichTextEmphasisGroup } from "./rich-text-emphasis-group.tsx"
import { RichTextFontGroup } from "./rich-text-font-group.tsx"
import { RichTextColorGroup } from "./rich-text-color-group.tsx"
import { RichTextParagraphGroup } from "./rich-text-paragraph-group.tsx"
import {
  type TextEditor,
  type TextFormatting,
} from "./rich-text-toolbar-control.tsx"

import { RichStructureControls } from "./rich-structure-controls.tsx"

type ToolbarState = { compact: boolean; open: boolean }
type ToolbarAction =
  { type: "resize"; compact: boolean } | { type: "open"; open: boolean }

function toolbarState(
  state: ToolbarState,
  action: ToolbarAction
): ToolbarState {
  switch (action.type) {
    case "resize":
      return { ...state, compact: action.compact }
    case "open":
      return { ...state, open: action.open }
  }
}

export function RichPaperTextFormatting({
  editor,
  blocked,
  photoControls,
}: {
  editor: TextEditor | null
  blocked: boolean
  photoControls?: (onAction: () => void) => ReactNode
}) {
  const [formatting, update] = useReducer(
    (_: TextFormatting | null, next: TextFormatting | null) => next,
    null
  )
  const host = useRef<HTMLDivElement>(null)
  const [{ compact, open }, dispatch] = useReducer(toolbarState, {
    compact: true,
    open: false,
  })
  const setOpen = (open: boolean) => dispatch({ type: "open", open })
  useEffect(() => {
    update(editor?.activeFormatting() ?? null)
    return editor?.subscribe(() => update(editor.activeFormatting()))
  }, [editor])
  const hasPhotoControls = Boolean(photoControls)
  useEffect(() => {
    if (!host.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry)
        dispatch({
          type: "resize",
          compact: entry.contentRect.width < (hasPhotoControls ? 1040 : 860),
        })
    })
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [hasPhotoControls])
  const disabled = !editor || blocked || !formatting?.hasText
  const inline = (patch: Parameters<TextEditor["formatInline"]>[0]) => {
    editor?.formatInline(patch)
    setOpen(false)
  }
  const paragraph = (patch: Parameters<TextEditor["formatParagraph"]>[0]) => {
    editor?.formatParagraph(patch)
    setOpen(false)
  }
  const controls = (
    <>
      <RichTextEmphasisGroup
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        overflow
      />
      <RichTextColorGroup
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        choose={inline}
      />
      {!compact ? (
        <div
          role="separator"
          aria-orientation="vertical"
          className="h-6 border-s border-border"
        />
      ) : null}
      {photoControls?.(() => setOpen(false))}
      {!compact && hasPhotoControls ? (
        <div
          role="separator"
          aria-orientation="vertical"
          className="h-6 border-s border-border"
        />
      ) : null}
      <div className={compact ? "contents" : "shrink-0 [&>div]:flex-nowrap"}>
        <RichTextParagraphGroup
          editor={editor}
          formatting={formatting}
          disabled={disabled}
          choose={paragraph}
        />
      </div>
    </>
  )
  return (
    <TooltipProvider>
      <div
        ref={host}
        role="toolbar"
        aria-label="Text formatting"
        data-slot="paper-text-formatting"
        className="flex min-w-0 shrink-0 items-center gap-1 overflow-x-auto border-b px-[12px] py-2"
      >
        <RichDocumentHistory editor={editor} blocked={blocked} />
        <div
          role="separator"
          aria-orientation="vertical"
          className="h-6 shrink-0 border-s border-border"
        />
        <RichStructureControls editor={editor} blocked={blocked}>
          {({ style, controls: structure }) => (
            <>
              {!compact ? (
                <>
                  {style}
                  <RichTextFontGroup
                    editor={editor}
                    formatting={formatting}
                    disabled={disabled}
                    choose={inline}
                  />
                </>
              ) : null}
              <RichTextEmphasisGroup
                editor={editor}
                formatting={formatting}
                disabled={disabled}
              />
              {compact ? (
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        aria-label="More formatting"
                        className="min-h-11 shrink-0 gap-1"
                        disabled={
                          !editor ||
                          blocked ||
                          (!formatting?.hasText && !hasPhotoControls)
                        }
                      />
                    }
                  >
                    <Ellipsis />
                    More
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    aria-label="More formatting"
                    className="max-h-[calc(100dvh-8rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain"
                    finalFocus={() => editor?.focus() ?? false}
                  >
                    <PopoverTitle>More formatting</PopoverTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      {style}
                      <RichTextFontGroup
                        editor={editor}
                        formatting={formatting}
                        disabled={disabled}
                        choose={inline}
                      />
                      {controls}
                      {structure}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <>
                  {controls}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    className="h-6 border-s border-border"
                  />
                  {structure}
                </>
              )}
            </>
          )}
        </RichStructureControls>
      </div>
    </TooltipProvider>
  )
}
