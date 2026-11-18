import { useLayoutEffect, useRef } from "react"

import { Button } from "@workspace/ui/components/button"

import {
  LIBRARY_SECTIONS,
  librarySections,
  type LibraryEntry,
  type LibraryView,
} from "./paper-library-entries.ts"
import { PaperLibrarySearch } from "./paper-library-search.tsx"
import {
  LibraryEntryCard,
  PaperLibrarySection,
  PaperProofsLink,
  type LibraryEntryHandlers,
} from "./paper-library-sections.tsx"

const VIEWS: readonly { id: LibraryView; title: string }[] = [
  { id: "all", title: "All" },
  ...LIBRARY_SECTIONS.filter(({ id }) => id !== "files"),
  { id: "proofs", title: "Proofs" },
  { id: "files", title: "Files" },
]

export function PaperLibraryCollection({
  entries,
  hasDocuments,
  query,
  selectedView,
  handlers,
  onQueryChange,
  onViewChange,
  onNewCV,
  onNewLetter,
  onImport,
}: {
  entries: LibraryEntry[]
  hasDocuments: boolean
  query: string
  selectedView: LibraryView | null
  handlers: LibraryEntryHandlers
  onQueryChange: (query: string) => void
  onViewChange: (view: LibraryView) => void
  onNewCV: () => void
  onNewLetter: () => void
  onImport: () => void
}) {
  const view = selectedView ?? "all"
  const needle = query.trim().toLowerCase()
  const sections = librarySections(entries, needle)
  const searching = needle !== ""
  const shownSections = LIBRARY_SECTIONS.filter(
    ({ id }) => view === "all" || view === id
  )
  const noResults = shownSections.every(({ id }) => sections[id].length === 0)
  const counts = librarySections(entries, "")
  const viewGroup = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const group = viewGroup.current
    if (!group) return
    const place = () => {
      const active = group.querySelector<HTMLElement>('[aria-pressed="true"]')
      const pill = group.querySelector<HTMLElement>(
        '[data-slot="paper-library-view-indicator"]'
      )
      if (!active || !pill) return
      const top = active.offsetTop
      const left = active.offsetLeft
      const right = group.clientWidth - left - active.offsetWidth
      const bottom = group.clientHeight - top - active.offsetHeight
      pill.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round 4px)`
    }
    place()
    const settle = requestAnimationFrame(() => {
      group.dataset.placed = "true"
    })
    if (typeof ResizeObserver === "undefined")
      return () => cancelAnimationFrame(settle)
    const observer = new ResizeObserver(place)
    observer.observe(group)
    return () => {
      cancelAnimationFrame(settle)
      observer.disconnect()
    }
  }, [view])

  const sectionActions = {
    cv: {
      label: "New CV",
      empty: "No CVs yet.",
      detail: "Choose a template or begin on a blank page.",
      onCreate: onNewCV,
    },
    letter: {
      label: "New letter",
      empty: "No letters yet.",
      detail: "Start a Letter for your next application.",
      onCreate: onNewLetter,
    },
    files: {
      label: "Import a file",
      empty: "No files yet.",
      detail: "Bring a document you already have into Paper.",
      onCreate: onImport,
    },
  }

  return (
    <section
      aria-labelledby="paper-library-title"
      className="paper-library-collection"
    >
      <h2 id="paper-library-title" className="text-sm font-semibold">
        Library
      </h2>
      <div
        className="paper-library-controls"
        data-slot="paper-library-controls"
      >
        <div
          ref={viewGroup}
          role="group"
          aria-label="Library views"
          className="paper-library-views"
        >
          <span
            aria-hidden="true"
            data-slot="paper-library-view-indicator"
            className="paper-library-view-indicator"
          />
          {VIEWS.map(({ id, title }) => (
            <Button
              key={id}
              variant="ghost"
              aria-pressed={view === id}
              className="paper-library-view h-11 md:h-8"
              onClick={() => {
                if (view !== id) onViewChange(id)
              }}
            >
              {title}
              <span className="text-muted-foreground tabular-nums">
                {id === "all"
                  ? entries.length
                  : id === "proofs"
                    ? 0
                    : counts[id].length}
              </span>
            </Button>
          ))}
        </div>
        <PaperLibrarySearch query={query} onQueryChange={onQueryChange} />
      </div>
      <div
        key={view}
        className="paper-library-results"
        data-motion={selectedView ? "fade" : "enter"}
      >
        {view === "proofs" ? <PaperProofsLink /> : null}
        {view !== "proofs" && searching && noResults ? (
          <div role="status" className="paper-library-empty">
            <p className="font-medium text-foreground">
              No results for &quot;{query.trim()}&quot;
            </p>
            <p className="text-muted-foreground">
              Try another word, or clear the search.
            </p>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => onQueryChange("")}
            >
              Clear search
            </Button>
          </div>
        ) : null}
        {shownSections.map(({ id, title }) => {
          const items = sections[id]
          if (items.length === 0 && searching) return null
          if (
            items.length === 0 &&
            view === "all" &&
            id !== "files" &&
            hasDocuments
          )
            return null
          return (
            <PaperLibrarySection
              key={id}
              title={title}
              count={items.length}
              action={searching ? undefined : sectionActions[id]}
            >
              {items.map((entry) => (
                <LibraryEntryCard key={entry.key} entry={entry} on={handlers} />
              ))}
            </PaperLibrarySection>
          )
        })}
        {view === "all" && !searching ? <PaperProofsLink /> : null}
      </div>
    </section>
  )
}
