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
      <h2
        id="paper-library-title"
        className="text-xl font-semibold tracking-tight"
      >
        Library
      </h2>
      <div
        className="paper-library-controls"
        data-slot="paper-library-controls"
      >
        <div
          role="group"
          aria-label="Library views"
          className="paper-library-views"
        >
          {VIEWS.map(({ id, title }) => (
            <Button
              key={id}
              variant="ghost"
              aria-pressed={view === id}
              className="paper-library-view"
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
