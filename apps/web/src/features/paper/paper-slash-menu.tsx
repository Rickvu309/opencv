import { useEffect, useRef } from "react"
import type { CvSectionKind } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

export type SlashBlockType =
  "text" | "heading" | "bulleted-list" | "numbered-list" | "divider"

export type SlashChoice =
  | { group: "section"; kind: CvSectionKind; label: string; hint: string }
  | { group: "block"; type: SlashBlockType; label: string }

export const SLASH_ITEMS: SlashChoice[] = [
  { group: "section", kind: "summary", label: "Summary", hint: "2 to 3 lines" },
  {
    group: "section",
    kind: "projects",
    label: "Projects",
    hint: "Things you built",
  },
  {
    group: "section",
    kind: "activities",
    label: "Activities",
    hint: "Clubs, volunteering",
  },
  {
    group: "section",
    kind: "awards",
    label: "Awards",
    hint: "Prizes, scholarships",
  },
  {
    group: "section",
    kind: "languages",
    label: "Languages",
    hint: "With level",
  },
  { group: "block", type: "text", label: "Text" },
  { group: "block", type: "heading", label: "Heading" },
  { group: "block", type: "bulleted-list", label: "Bulleted list" },
  { group: "block", type: "numbered-list", label: "Numbered list" },
  { group: "block", type: "divider", label: "Divider" },
]

export function filterSlashItems(query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return SLASH_ITEMS
  return SLASH_ITEMS.filter((item) => item.label.toLowerCase().includes(needle))
}

export function PaperSlashMenu({
  query,
  activeIndex,
  side,
  onQuery,
  onActive,
  onPick,
  onClose,
}: {
  query: string
  activeIndex: number
  side: "top" | "bottom"
  onQuery: (value: string) => void
  onActive: (index: number) => void
  onPick: (choice: SlashChoice) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const items = filterSlashItems(query)
  const sections = items.filter((item) => item.group === "section")
  const blocks = items.filter((item) => item.group === "block")

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function move(delta: number) {
    if (items.length === 0) return
    const next = (activeIndex + delta + items.length) % items.length
    onActive(next)
  }

  return (
    <div
      role="listbox"
      aria-label="Insert"
      className={cn(
        "absolute z-50 flex w-64 flex-col gap-2 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md",
        side === "top" ? "bottom-full mb-1" : "top-full mt-1"
      )}
    >
      <Input
        ref={inputRef}
        aria-label="Type to filter"
        placeholder="Type to filter"
        value={query}
        onChange={(event) => {
          onQuery(event.target.value)
          onActive(0)
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            move(1)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            move(-1)
          } else if (event.key === "Enter") {
            event.preventDefault()
            const choice = items[activeIndex]
            if (choice) onPick(choice)
          } else if (event.key === "Escape") {
            event.preventDefault()
            onClose()
          }
        }}
      />
      {sections.length > 0 ? (
        <div role="group" aria-label="CV sections" className="flex flex-col">
          <p className="px-2 text-xs text-muted-foreground">CV sections</p>
          {sections.map((item) => (
            <SlashOption
              key={item.label}
              item={item}
              selected={items[activeIndex] === item}
              onHover={() => onActive(items.indexOf(item))}
              onPick={() => onPick(item)}
            />
          ))}
        </div>
      ) : null}
      {blocks.length > 0 ? (
        <div role="group" aria-label="Blocks" className="flex flex-col">
          <p className="px-2 text-xs text-muted-foreground">Blocks</p>
          {blocks.map((item) => (
            <SlashOption
              key={item.label}
              item={item}
              selected={items[activeIndex] === item}
              onHover={() => onActive(items.indexOf(item))}
              onPick={() => onPick(item)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SlashOption({
  item,
  selected,
  onHover,
  onPick,
}: {
  item: SlashChoice
  selected: boolean
  onHover: () => void
  onPick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      role="option"
      aria-selected={selected}
      className={cn(
        "h-auto w-full justify-between px-2",
        selected && "bg-accent text-accent-foreground"
      )}
      onMouseEnter={onHover}
      onClick={onPick}
    >
      <span>{item.label}</span>
      {item.group === "section" ? (
        <span className="text-xs text-muted-foreground">{item.hint}</span>
      ) : null}
    </Button>
  )
}
