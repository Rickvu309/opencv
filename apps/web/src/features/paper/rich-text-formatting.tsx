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
import { useToolbarOverflow } from "./rich-text-toolbar-overflow.ts"
import { ToolbarItemsContext } from "./rich-text-toolbar-item.tsx"
import {
  type TextEditor,
  type TextFormatting,
} from "./rich-text-toolbar-control.tsx"
import { RichStructureControls } from "./rich-structure-controls.tsx"

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
  const [open, setOpen] = useReducer((_: boolean, next: boolean) => next, false)
  const host = useRef<HTMLDivElement>(null)
  const layout = useToolbarOverflow(host)
  useEffect(() => {
    update(editor?.activeFormatting() ?? null)
    return editor?.subscribe(() => update(editor.activeFormatting()))
  }, [editor])
  const disabled = !editor || blocked || !formatting?.hasText
  const inline = (patch: Parameters<TextEditor["formatInline"]>[0]) => {
    editor?.formatInline(patch)
    setOpen(false)
  }
  const paragraph = (patch: Parameters<TextEditor["formatParagraph"]>[0]) => {
    editor?.formatParagraph(patch)
    setOpen(false)
  }
  const controls = (style: ReactNode, structure: ReactNode) => (
    <>
      {style}
      <RichTextFontGroup
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        choose={inline}
      />
      <RichTextEmphasisGroup
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        all
        onAction={() => setOpen(false)}
      />
      <RichTextColorGroup
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        choose={inline}
      />
      {Array.isArray(structure) ? structure.slice(0, 1) : null}
      {photoControls?.(() => setOpen(false))}
      <RichTextParagraphGroup
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        choose={paragraph}
      />
      {Array.isArray(structure) ? structure.slice(1) : structure}
    </>
  )
  return (
    <TooltipProvider>
      <div
        ref={host}
        role="toolbar"
        aria-label="Text formatting"
        data-slot="paper-text-formatting"
        className="relative flex min-w-0 shrink-0 items-center gap-1 border-b px-[12px] py-2 [&_[data-toolbar-group]]:contents"
      >
        <div data-toolbar-pinned className="shrink-0">
          <RichDocumentHistory editor={editor} blocked={blocked} />
        </div>
        <div
          data-toolbar-pinned
          role="separator"
          aria-orientation="vertical"
          className="h-6 shrink-0 border-s border-border"
        />
        <RichStructureControls editor={editor} blocked={blocked}>
          {({ style, controls: structure }) => (
            <>
              <ToolbarItemsContext
                value={{ surface: "bar", visible: layout.visible }}
              >
                {controls(style, structure)}
              </ToolbarItemsContext>
              <Popover open={open && layout.more} onOpenChange={setOpen}>
                <span
                  className={
                    layout.more
                      ? "inline-flex shrink-0"
                      : "pointer-events-none invisible absolute inline-flex"
                  }
                  aria-hidden={!layout.more || undefined}
                  inert={!layout.more || undefined}
                >
                  <PopoverTrigger
                    render={
                      <Button
                        data-toolbar-more
                        variant="ghost"
                        aria-label="More formatting"
                        className={
                          layout.iconOnly
                            ? "size-[44px] shrink-0 md:size-8"
                            : "min-h-11 shrink-0 gap-1 md:min-h-8"
                        }
                        disabled={
                          !editor ||
                          blocked ||
                          (!formatting?.hasText && !photoControls)
                        }
                      />
                    }
                  >
                    <Ellipsis />
                    <span
                      data-toolbar-more-label
                      className={
                        layout.iconOnly
                          ? "invisible absolute whitespace-nowrap"
                          : undefined
                      }
                    >
                      More
                    </span>
                  </PopoverTrigger>
                </span>
                <PopoverContent
                  align="end"
                  aria-label="More formatting"
                  className="max-h-[calc(100dvh-8rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain"
                  finalFocus={() => editor?.focus() ?? false}
                >
                  <PopoverTitle>More formatting</PopoverTitle>
                  <div className="flex flex-wrap items-center gap-2 [&_[data-toolbar-group]]:contents">
                    <ToolbarItemsContext
                      value={{ surface: "menu", visible: layout.visible }}
                    >
                      {controls(style, structure)}
                    </ToolbarItemsContext>
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
        </RichStructureControls>
      </div>
    </TooltipProvider>
  )
}
