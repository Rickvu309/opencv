import { SearchInput } from "@workspace/ui/components/search-input"

export function PaperLibrarySearch({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (query: string) => void
}) {
  return (
    <div
      data-slot="paper-library-search"
      className="order-last basis-full md:order-none md:basis-auto"
    >
      <SearchInput
        aria-label="Search Paper"
        placeholder="Search Paper"
        value={query}
        onValueChange={onQueryChange}
        className="text-base md:text-[12.5px]"
        onKeyDown={(event) => {
          if (event.key !== "Escape" || query.length === 0) return
          event.preventDefault()
          event.stopPropagation()
          onQueryChange("")
        }}
      />
    </div>
  )
}
