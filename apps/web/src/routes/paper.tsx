import { useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useFirstCafeSurfaceVisit } from "@/features/home/use-first-cafe-surface-visit.ts"
import {
  listPaper,
  listPaperFiles,
  paperQueryKeys,
} from "@/features/paper/paper-api.ts"
import { PaperLibrary } from "@/features/paper/paper-library.tsx"

export function PaperPage() {
  useFirstCafeSurfaceVisit("sample-cv")
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const docs = useQuery({
    queryKey: paperQueryKeys.list(),
    queryFn: listPaper,
  })
  const files = useQuery({
    queryKey: paperQueryKeys.files(),
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
        void navigate({ to: "/app/paper/$docId", params: { docId: id } })
      }
      onChanged={() =>
        void queryClient.invalidateQueries({ queryKey: paperQueryKeys.all })
      }
    />
  )
}
