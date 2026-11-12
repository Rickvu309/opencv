import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { LibraryFilter } from "./paper-library.reducer.ts"

const DOCUMENT_TYPES = [
  { value: "all", label: "All" },
  { value: "cv", label: "CVs" },
  { value: "letter", label: "Cover letters" },
  { value: "files", label: "Files" },
] as const

export function PaperLibraryFilters({
  filter,
  query,
  onFilterChange,
  onQueryChange,
}: {
  filter: LibraryFilter
  query: string
  onFilterChange: (filter: LibraryFilter) => void
  onQueryChange: (query: string) => void
}) {
  return (
    <div
      data-slot="paper-library-filters"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div role="group" aria-label="Document type" className="flex gap-1">
        {DOCUMENT_TYPES.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            variant={filter === value ? "secondary" : "ghost"}
            size="sm"
            className="h-11 md:h-8"
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <Input
        aria-label="Search Paper"
        placeholder="Search documents"
        className="w-full sm:w-56"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </div>
  )
}
