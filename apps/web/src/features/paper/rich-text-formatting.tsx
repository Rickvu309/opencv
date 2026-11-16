import { useEffect, useReducer, useRef, useState, type ReactNode } from "react"
import { Ellipsis } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from "@workspace/ui/components/popover"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { RichTextFontGroup } from "./rich-text-font-group.tsx"
import { RichTextColorGroup } from "./rich-text-color-group.tsx"
import { RichTextParagraphGroup } from "./rich-text-paragraph-group.tsx"
import {
  type TextEditor,
  type TextFormatting,
} from "./rich-text-toolbar-control.tsx"

export function RichPaperTextFormatting({
  editor,
  blocked,
  children,
}: {
  editor: TextEditor | null
  blocked: boolean
  children: ReactNode
}) {
  const [formatting, update] = useReducer(
    (_: TextFormatting | null, next: TextFormatting | null) => next,
    null
  )
  const host = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(true)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    update(editor?.activeFormatting() ?? null)
    return editor?.subscribe(() => update(editor.activeFormatting()))
  }, [editor])
  useEffect(() => {
    if (!host.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setCompact(entry.contentRect.width < 860)
    })
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
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
      <fieldset
        disabled={disabled}
        onClick={() => setOpen(false)}
        aria-label="Text emphasis"
        className="flex shrink-0 items-center gap-1 border-s border-border ps-2"
      >
        {children}
      </fieldset>
      <RichTextColorGroup
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        choose={inline}
      />
      <div
        role="separator"
        aria-orientation="vertical"
        className="h-6 border-s border-border"
      />
      <RichTextParagraphGroup
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        choose={paragraph}
      />
    </>
  )
  return (
    <TooltipProvider>
      <div
        ref={host}
        role="toolbar"
        aria-label="Text formatting"
        data-slot="paper-text-formatting"
        className="flex min-w-0 shrink-0 items-center gap-1 border-b px-3 py-2"
      >
        <RichTextFontGroup
          editor={editor}
          formatting={formatting}
          disabled={disabled}
          choose={inline}
        />
        {compact ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  aria-label="More formatting"
                  className="min-h-11 shrink-0 gap-1"
                  disabled={disabled}
                />
              }
            >
              <Ellipsis />
              More
            </PopoverTrigger>
            <PopoverContent
              align="end"
              aria-label="More formatting"
              className="w-[min(22rem,calc(100vw-2rem))]"
              finalFocus={false}
            >
              <PopoverTitle>More formatting</PopoverTitle>
              <div className="flex flex-wrap items-center gap-2">
                {controls}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          controls
        )}
      </div>
    </TooltipProvider>
  )
}
