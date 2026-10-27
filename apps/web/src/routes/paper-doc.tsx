import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"

import { PaperCvEditor } from "@/features/paper/paper-editor.tsx"
import { PaperLetterEditor } from "@/features/paper/paper-letter.tsx"
import {
  getPaper,
  getPaperPages,
  listJobs,
  listPaper,
  paperQueryKeys,
} from "@/features/paper/paper-api.ts"

function docIdFromPath(pathname: string) {
  const prefix = "/app/paper/"
  if (!pathname.startsWith(prefix)) return ""
  return decodeURIComponent(pathname.slice(prefix.length).split("/")[0] ?? "")
}

export function PaperDocPage() {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const docId = docIdFromPath(pathname)
  const docQuery = useQuery({
    queryKey: paperQueryKeys.detail(docId),
    queryFn: () => getPaper(docId),
    enabled: docId.length > 0,
  })
  const pagesQuery = useQuery({
    queryKey: paperQueryKeys.pages(docId),
    queryFn: () => getPaperPages(docId),
    enabled: docQuery.data?.kind === "cv",
  })
  const jobsQuery = useQuery({
    queryKey: ["paper", "jobs"],
    queryFn: listJobs,
    enabled: docQuery.data?.kind === "letter",
  })
  const listQuery = useQuery({
    queryKey: paperQueryKeys.list(),
    queryFn: listPaper,
    enabled: docQuery.data?.kind === "letter",
  })
  const back = () => void navigate({ to: "/app/paper" })

  if (docQuery.isLoading) {
    return (
      <section aria-label="Paper" className="p-4">
        <p>Loading documents</p>
      </section>
    )
  }
  if (!docQuery.data) {
    return (
      <section
        aria-label="Paper"
        className="flex flex-col items-start gap-3 p-4"
      >
        <p>Could not load documents. Refresh the page.</p>
        <Button type="button" variant="outline" onClick={back}>
          Paper
        </Button>
      </section>
    )
  }
  const doc = docQuery.data
  if (doc.kind === "letter") {
    const job =
      jobsQuery.data?.find((item) => item.letterDocId === doc.id) ?? null
    const cvs = (listQuery.data ?? []).filter((item) => item.kind === "cv")
    const linked = cvs.find((item) => item.id === job?.cvDocId)
    const latest = [...cvs].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )[0]
    return (
      <PaperLetterEditor
        key={doc.id}
        doc={doc}
        job={job}
        cvName={linked?.name ?? latest?.name ?? null}
        onBack={back}
      />
    )
  }
  if (doc.kind === "proof") {
    return (
      <section
        aria-label="Paper"
        className="flex flex-col items-start gap-3 p-4"
      >
        <p>Proofs open on the Proof page.</p>
        <Button type="button" variant="outline" onClick={back}>
          Paper
        </Button>
      </section>
    )
  }
  return (
    <PaperCvEditor
      key={doc.id}
      initial={doc}
      pages={
        pagesQuery.data ?? {
          docId: doc.id,
          pages: 1,
          pageChoice: doc.pageChoice,
        }
      }
      onBack={back}
    />
  )
}
