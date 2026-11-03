import { useLayoutEffect, useRef } from "react"
import type {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core"
import { filterSuggestionItems } from "@blocknote/core/extensions"
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useBlockNoteEditor,
  type DefaultReactSuggestionItem,
  type SuggestionMenuProps,
} from "@blocknote/react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { cvSlashItems, filterCvSlash } from "./cv-slash.ts"

const SLASH_TITLES = new Set([
  "Paragraph",
  "Heading 2",
  "Heading 3",
  "Numbered List",
  "Bullet List",
  "Divider",
])

const SLASH_KEYS: Record<string, string[]> = {
  Heading: ["⌘", "⌥", "1"],
  "Bulleted list": ["⌘", "⇧", "8"],
  "Numbered list": ["⌘", "⇧", "9"],
}

function SlashList({
  items,
  selectedIndex,
  onItemClick,
}: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >()
  const menuRef = useRef<HTMLDivElement>(null)
  const cv = "paperHeader" in editor.schema.blockSchema
  useLayoutEffect(() => {
    if (!cv) return
    const menu = menuRef.current
    const pane = document.querySelector<HTMLElement>(
      '[data-slot="cv-editor-page"]'
    )
    if (!menu || !pane) return
    const paneRect = pane.getBoundingClientRect()
    const pin = () => {
      let host = menu.parentElement
      while (host && host !== document.body) {
        const style = getComputedStyle(host)
        if (style.position !== "static" || style.transform !== "none") {
          const width = menu.offsetWidth || 300
          const height = menu.offsetHeight || 0
          const edge = 8
          let left = paneRect.left + 366
          let top = paneRect.top + 269
          if (left + width > window.innerWidth - edge) {
            left = Math.max(edge, window.innerWidth - edge - width)
          }
          if (left < edge) left = edge
          const slash = document.querySelector<HTMLElement>(
            "[data-cv-slash-block]"
          )
          const slashRect = slash?.getBoundingClientRect()
          const caretLow =
            !!slashRect && slashRect.bottom + height > window.innerHeight - edge
          if (
            height > 0 &&
            slashRect &&
            (caretLow || window.innerWidth < 768)
          ) {
            const below = slashRect.bottom + 4
            const above = slashRect.top - height - 4
            top =
              below + height <= window.innerHeight - edge
                ? below
                : above >= edge
                  ? above
                  : Math.max(edge, window.innerHeight - edge - height)
            left = Math.min(
              Math.max(edge, slashRect.left),
              window.innerWidth - edge - width
            )
          } else if (
            height > 0 &&
            slashRect &&
            top + height > window.innerHeight - edge
          ) {
            const up = slashRect.top - height - edge
            top =
              up >= edge
                ? up
                : Math.max(edge, window.innerHeight - edge - height)
          }
          host.style.position = "fixed"
          host.style.left = `${left}px`
          host.style.top = `${top}px`
          host.style.right = "auto"
          host.style.bottom = "auto"
          host.style.transform = "none"
          host.style.margin = "0"
          return
        }
        host = host.parentElement
      }
    }
    const slashLine = () => {
      const anchor = document.getSelection()?.anchorNode
      const current = anchor instanceof Element ? anchor : anchor?.parentElement
      const currentLine = current?.closest<HTMLElement>(".bn-inline-content")
      const nodes = [
        ...document.querySelectorAll<HTMLElement>(
          "[data-cv-editor] .bn-inline-content"
        ),
      ]
      const ordered = currentLine
        ? [currentLine, ...nodes.filter((node) => node !== currentLine)]
        : nodes
      for (const node of ordered) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
        for (let next = walker.nextNode(); next; next = walker.nextNode()) {
          if (next.textContent?.trim() === "/") return node
        }
      }
      return null
    }
    const place = () => {
      pin()
      const slash = slashLine()
      const outer = slash?.closest<HTMLElement>(".bn-block-outer")
      const surface = document.querySelector<HTMLElement>(
        "[data-pen-surface='paper']"
      )
      if (!slash || !outer || !surface) return
      outer.dataset.cvSlashBlock = ""
      let text: Text | null = null
      const walker = document.createTreeWalker(slash, NodeFilter.SHOW_TEXT)
      for (let next = walker.nextNode(); next; next = walker.nextNode()) {
        if (next.textContent?.trim() === "/") text = next as Text
      }
      if (!text) return
      const range = document.createRange()
      range.selectNodeContents(text)
      const rect = range.getBoundingClientRect()
      let hint = document.querySelector<HTMLElement>("[data-cv-slash-hint]")
      if (!hint) {
        hint = document.createElement("span")
        hint.dataset.cvSlashHint = ""
        hint.textContent = "Type to filter"
        surface.appendChild(hint)
      }
      hint.style.position = "fixed"
      hint.style.margin = "0"
      hint.style.left = `${rect.right + 6}px`
      hint.style.top = `${rect.top}px`
    }
    let frame = 0
    let live = true
    const tick = () => {
      if (!live) return
      place()
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      live = false
      cancelAnimationFrame(frame)
      document.querySelector("[data-cv-slash-hint]")?.remove()
      const outer = document.querySelector<HTMLElement>("[data-cv-slash-block]")
      if (outer) {
        outer.style.removeProperty("margin-top")
        outer.removeAttribute("data-cv-slash-block")
      }
    }
  }, [cv])
  return (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={cv ? "Insert" : "Blocks"}
      data-pen-surface={cv ? "paper" : undefined}
      data-slot="paper-slash-menu"
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md",
        cv ? "w-[300px]" : "w-56"
      )}
    >
      {items.map((item, index) => {
        const group = item.group ?? ""
        const before = items[index - 1]?.group ?? ""
        const showGroup = cv && group !== before
        const divider = showGroup && before !== "" && group === "Blocks"
        const keys = cv ? SLASH_KEYS[item.title] : undefined
        return (
          <div key={`${group}:${item.title}`}>
            {divider ? <div data-cv-slash-divider="" /> : null}
            {showGroup ? <p data-cv-slash-group="">{group}</p> : null}
            <Button
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              variant="ghost"
              size="sm"
              className={cn(
                "h-11 w-full justify-start text-xs md:h-8",
                index === selectedIndex && "bg-accent text-accent-foreground"
              )}
              onClick={() => onItemClick?.(item)}
            >
              <span className="inline-flex min-w-0 items-center gap-[10px]">
                <span aria-hidden="true" className="inline-block size-[15px]" />
                <span data-cv-slash-title="">{item.title}</span>
              </span>
              {item.subtext ? (
                <span data-cv-slash-sub="">{item.subtext}</span>
              ) : null}
              {keys ? (
                <span className="ms-auto inline-flex gap-1">
                  {keys.map((key) => (
                    <span key={key} data-cv-slash-key="">
                      {key}
                    </span>
                  ))}
                </span>
              ) : null}
            </Button>
          </div>
        )
      })}
      {items.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">No blocks</p>
      ) : null}
    </div>
  )
}

export function PaperSlashMenu() {
  const editor = useBlockNoteEditor<
    BlockSchema,
    InlineContentSchema,
    StyleSchema
  >()
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      shouldOpen={(state) =>
        state.selection.$from.parent.type.name !== "paperSection"
      }
      getItems={async (query) =>
        "paperHeader" in editor.schema.blockSchema
          ? filterCvSlash(cvSlashItems(editor), query)
          : filterSuggestionItems(
              getDefaultReactSlashMenuItems(editor).filter((item) =>
                SLASH_TITLES.has(item.title)
              ),
              query
            )
      }
      suggestionMenuComponent={SlashList}
    />
  )
}
