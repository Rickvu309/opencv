import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import {
  listPaper,
  listPaperFiles,
  paperFilesKey,
  paperListKey,
} from "@/features/paper/paper-api.ts"
import { PaperLibrary } from "@/features/paper/paper-library.tsx"

export function PaperPage() {
  const navigate = useNavigate()
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
      onOpen={(id) =>
        void navigate({ to: "/paper/$docId", params: { docId: id } })
      }
    />
  )
}
