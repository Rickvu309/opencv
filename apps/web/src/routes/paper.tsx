import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { parseFileId } from "@workspace/domain/kernel"

import { catalogClient } from "@/lib/contract-client.ts"
import { useOwnerId } from "@/lib/owner-id.ts"
import { paperLibraryQuery } from "@/lib/paper-list.ts"
import { PaperLibrary } from "@/features/paper/paper-library.tsx"
import { validatePaperSearch } from "@/features/paper/paper-templates.ts"

export function PaperPage() {
  const navigate = useNavigate()
  const routeSearch = useRouterState({
    select: (state) => state.location.search,
  })
  const search = validatePaperSearch(routeSearch)
  const query = search.q ?? ""
  const onQueryChange = (nextQuery: string) =>
    void navigate({
      to: "/paper",
      search: nextQuery === "" ? {} : { q: nextQuery },
      replace: true,
      resetScroll: false,
    })
  const docs = useQuery({
    ...paperLibraryQuery(useOwnerId()),
    refetchOnMount: false,
  })
  const files = catalogClient.useRead(useOwnerId(), "paper.files", {})

  return (
    <PaperLibrary
      docs={docs.data ?? []}
      files={(files.data ?? []).map((file) => ({
        ...file,
        id: parseFileId(file.id),
      }))}
      loading={docs.isLoading}
      error={
        docs.isError ? "Could not load documents. Refresh the page." : null
      }
      onRetry={() => void docs.refetch()}
      query={query}
      onQueryChange={onQueryChange}
      onOpen={(id) =>
        void navigate({ to: "/paper/$docId", params: { docId: id }, search })
      }
    />
  )
}
