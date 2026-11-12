import { Search } from "lucide-react"

import { Input } from "@workspace/ui/components/input"

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
      className="relative order-last basis-full md:order-none md:basis-auto"
    >
      <Search
        data-slot="paper-library-search-icon"
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        aria-label="Search Paper"
        placeholder="Search Paper"
        className="h-11 border-0 bg-secondary pr-2.5 pl-8 md:h-8 md:text-[12.5px]"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </div>
  )
}
