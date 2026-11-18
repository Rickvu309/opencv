import { useRef } from "react"

import { Button } from "@workspace/ui/components/button"
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

export function PaperViewChips({
  view,
  onViewChange,
}: {
  view: LibraryView
  onViewChange: (view: LibraryView) => void
}) {
  return (
    <div role="group" aria-label="Library views" className="paper-hand-chips">
      {VIEWS.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="ghost"
          className="paper-hand-chip h-11 hover:bg-transparent md:h-7"
          aria-pressed={view === item.id}
          onClick={() => onViewChange(item.id)}
        >
          {item.title}
        </Button>
      ))}
    </div>
  )
}

export function PaperFind({
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
    <div className="paper-hand-find">
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
        <span className="paper-hand-kbd" aria-hidden="true">
          /
        </span>
      ) : null}
    </div>
  )
}
