import { useRef } from "react"

import { ChevronDown } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { SearchInput } from "@workspace/ui/components/search-input"

import { useShortcut } from "@/lib/use-shortcut.ts"

import type { LibraryView } from "./paper-library-entries.ts"

const TYPE_TO_FIND = [..."abcdefghijklmnopqrstuvwxyz0123456789"]

const VIEWS: readonly { id: LibraryView; title: string }[] = [
  { id: "all", title: "All" },
  { id: "cv", title: "CVs" },
  { id: "letter", title: "Letters" },
  { id: "proofs", title: "Proofs" },
  { id: "files", title: "Files" },
]

function focusIsIdle() {
  const node = document.activeElement
  if (!node || node === document.body || node === document.documentElement)
    return true
  return false
}

export function PaperViewMenu({
  view,
  counts,
  onViewChange,
}: {
  view: LibraryView
  counts: Partial<Record<LibraryView, number>>
  onViewChange: (view: LibraryView) => void
}) {
  const current = VIEWS.find((item) => item.id === view) ?? VIEWS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="touch"
            type="button"
            variant="ghost"
            className="paper-command-view hover:bg-transparent"
            aria-label={`Show ${current.title}`}
          >
            {current.title}
            <ChevronDown aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="paper-command-menu">
        <DropdownMenuRadioGroup
          value={view}
          onValueChange={(next: LibraryView) => onViewChange(next)}
        >
          {VIEWS.map((item) => (
            <DropdownMenuRadioItem key={item.id} value={item.id} closeOnClick>
              {item.title}
              {counts[item.id] ? (
                <span className="paper-command-count">{counts[item.id]}</span>
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PaperCommandBar({
  view,
  counts,
  query,
  onViewChange,
  onQueryChange,
}: {
  view: LibraryView
  counts: Partial<Record<LibraryView, number>>
  query: string
  onViewChange: (view: LibraryView) => void
  onQueryChange: (query: string) => void
}) {
  return (
    <div data-slot="paper-command" className="paper-command">
      <PaperViewMenu view={view} counts={counts} onViewChange={onViewChange} />
      <PaperFind query={query} onQueryChange={onQueryChange} />
    </div>
  )
}

function PaperFind({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (query: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  function canTakeOver() {
    if (document.activeElement === inputRef.current) return false
    if (!focusIsIdle()) return false
    return !document.querySelector(
      "[data-slot='dialog-content'], [data-slot='dropdown-menu-content']"
    )
  }
  useShortcut({
    key: "/",
    onPress: () => {
      if (canTakeOver()) inputRef.current?.focus()
    },
  })
  useShortcut({
    key: TYPE_TO_FIND,
    prevent: false,
    onPress: () => {
      if (canTakeOver()) inputRef.current?.focus()
    },
  })
  return (
    <div className="paper-command-find">
      <SearchInput
        ref={inputRef}
        aria-label="Search Paper"
        placeholder="Type to find a document"
        value={query}
        onValueChange={onQueryChange}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          event.stopPropagation()
          onQueryChange("")
          event.currentTarget.blur()
        }}
      />
      {query.length === 0 ? (
        <span className="paper-command-kbd" aria-hidden="true">
          /
        </span>
      ) : null}
    </div>
  )
}
