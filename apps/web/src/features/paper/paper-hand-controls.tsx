import { useEffect, useRef } from "react"

import { Button } from "@workspace/ui/components/button"
import { SearchInput } from "@workspace/ui/components/search-input"

import type { LibraryView } from "./paper-library-entries.ts"

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
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const printable =
        event.key === "/" || (event.key.length === 1 && /\S/.test(event.key))
      if (!printable) return
      if (document.activeElement === inputRef.current) return
      if (!focusIsIdle()) return
      if (
        document.querySelector(
          "[data-slot='dialog-content'], [data-slot='dropdown-menu-content']"
        )
      )
        return
      if (event.key === "/") event.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])
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
