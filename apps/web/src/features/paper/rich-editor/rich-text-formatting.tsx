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
import { cn } from "@workspace/ui/lib/utils"
import { FocusSafeRegion } from "@/components/focus-safe-region.tsx"
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
import { RichTextCustomSpacing } from "./rich-text-custom-spacing.tsx"
import { RichPageBreak } from "./rich-page-break.tsx"

export function RichPaperTextFormatting({
  editor,
  blocked,
  photoControls,
  panel = false,
}: {
  editor: TextEditor | null
  blocked: boolean
  panel?: boolean
  photoControls?: (onAction: () => void) => ReactNode
}) {
  const [formatting, update] = useReducer(
    (_: TextFormatting | null, next: TextFormatting | null) => next,
    null
  )
  const [open, setOpen] = useReducer((_: boolean, next: boolean) => next, false)
  const host = useRef<HTMLDivElement>(null)
  const layout = useToolbarOverflow(host, editor)
  const compact = layout.more
  if (!compact && open) setOpen(false)
  const hasPhotoControls = Boolean(photoControls)
  const focusFallback = () => {
    editor?.focus()
    return document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  }
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
  const separator = (
    <div
      data-toolbar-desktop-separator
      role="separator"
      aria-orientation="vertical"
      className={compact ? "hidden" : "h-6 shrink-0 border-s border-border"}
    />
  )
  const controls = (
    style: ReactNode,
    structure: ReactNode,
    groupSeparator: ReactNode
  ) => (
    <>
      {style}
      <RichTextFontGroup
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        choose={inline}
        onAction={() => setOpen(false)}
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
      {groupSeparator}
      {photoControls?.(() => setOpen(false))}
      {hasPhotoControls ? groupSeparator : null}
      <RichPageBreak
        editor={editor}
        blocked={blocked}
        onAction={() => setOpen(false)}
      />
      {groupSeparator}
      <RichTextParagraphGroup
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        choose={paragraph}
      />
      <RichTextCustomSpacing
        editor={editor}
        formatting={formatting}
        disabled={disabled}
        onAction={() => setOpen(false)}
      />
      {groupSeparator}
      {structure}
    </>
  )
  if (panel)
    return (
      <TooltipProvider>
        <div
          role="toolbar"
          aria-label="Text formatting"
          className="flex flex-wrap items-center gap-2"
        >
          <RichDocumentHistory editor={editor} blocked={blocked} />
          <RichStructureControls editor={editor} blocked={blocked}>
            {({ style, controls: structure }) =>
              controls(style, structure, null)
            }
          </RichStructureControls>
        </div>
      </TooltipProvider>
    )
  return (
    <TooltipProvider>
      <div
        ref={host}
        role="toolbar"
        aria-label="Text formatting"
        data-slot="paper-text-formatting"
        className={cn(
          "relative flex min-w-0 items-center gap-1 border-b px-[12px] py-2 [&_[data-toolbar-group]]:contents [&_[data-toolbar-group][hidden]]:hidden",
          "shrink-0 [&>div]:flex-nowrap"
        )}
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
                value={{
                  surface: "bar",
                  visible: layout.visible,
                  focusFallback,
                }}
              >
                {controls(style, structure, separator)}
              </ToolbarItemsContext>
              <Popover open={!compact ? false : open} onOpenChange={setOpen}>
                <FocusSafeRegion
                  className={
                    layout.more
                      ? "inline-flex shrink-0"
                      : "pointer-events-none invisible absolute inline-flex"
                  }
                  aria-hidden={!layout.more || undefined}
                  concealed={!layout.more}
                  focusFallback={focusFallback}
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
                          (!formatting?.hasText && !hasPhotoControls)
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
                </FocusSafeRegion>
                <PopoverContent
                  align="end"
                  aria-label="More formatting"
                  className="max-h-[calc(100dvh-8rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain"
                  finalFocus={() => editor?.focus() ?? false}
                >
                  <PopoverTitle>More formatting</PopoverTitle>
                  <div className="flex flex-wrap items-center gap-2 [&_[data-toolbar-group]]:contents [&_[data-toolbar-group][hidden]]:hidden">
                    <ToolbarItemsContext
                      value={{
                        surface: "menu",
                        visible: layout.visible,
                        focusFallback,
                      }}
                    >
                      {controls(style, structure, null)}
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
