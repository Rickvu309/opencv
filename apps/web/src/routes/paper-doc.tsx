import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { paperIdSchema, parsePaperId } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"

import { PaperCvEditor } from "@/features/paper/paper-editor.tsx"
import { PaperLetterEditor } from "@/features/paper/paper-letter.tsx"
import {
  getPaper,
  getPaperPages,
  listPaper,
  paperGetKey,
  paperListKey,
  paperPagesKey,
} from "@/features/paper/paper-api.ts"
import { jobListKey, listJobs } from "@/features/apply/apply-api.ts"

const NO_DOC = parsePaperId("00000000-0000-4000-8000-000000000000")

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
  const parsedId = paperIdSchema.safeParse(docId)
  const validId = parsedId.success ? parsedId.data : null
  const docQuery = useQuery({
    queryKey: paperGetKey(validId ?? NO_DOC),
    queryFn: () => getPaper(docId),
    enabled: validId !== null,
  })
  const pagesQuery = useQuery({
    queryKey: paperPagesKey(validId ?? NO_DOC),
    queryFn: () => getPaperPages(docId),
    enabled: docQuery.data?.kind === "cv",
  })
  const jobsQuery = useQuery({
    queryKey: jobListKey(),
    queryFn: listJobs,
    enabled: docQuery.data?.kind === "letter",
  })
  const listQuery = useQuery({
    queryKey: paperListKey(),
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
