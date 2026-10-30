import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import {
  listPaper,
  listPaperFiles,
  paperFilesKey,
  paperListKey,
} from "@/features/paper/paper-api.ts"
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
    queryKey: paperListKey(),
    queryFn: listPaper,
  })
  const files = useQuery({
    queryKey: paperFilesKey(),
    queryFn: listPaperFiles,
  })

  return (
    <PaperLibrary
      docs={docs.data ?? []}
      files={files.data ?? []}
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
