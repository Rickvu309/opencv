import { useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useReducer, useRef } from "react"
import type { LetterPaper, PaperDocument } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"

import { CvDocument } from "./cv-print-document.tsx"
import { LetterPrintView } from "./paper-letter-print.tsx"
import { CvPhotoFrame } from "./cv-templates/cv-parts.tsx"
import { getSharedPaper, paperSharedKey } from "./paper-api.ts"
import { PaperPrintSheet, previewOf } from "./paper-print-sheet.tsx"
import { printPaper, quietPaperChrome } from "./paper-print.ts"
import { printJobReducer } from "./paper-print-job.reducer.ts"

function letterOf(paper: PaperDocument | undefined): LetterPaper | null {
  if (!paper || paper.kind !== "letter") return null
  return paper
}

function shareToken(pathname: string) {
  if (!pathname.startsWith("/share/")) return ""
  return decodeURIComponent(pathname.slice("/share/".length))
}

export function PaperSharePage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const token = shareToken(pathname)
  const query = useQuery({
    queryKey: paperSharedKey(token),
    queryFn: () => getSharedPaper(token),
    enabled: token.length > 0,
  })
  const [printJob, dispatchPrint] = useReducer(printJobReducer, null)
  const quietRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (quietRef.current) quietPaperChrome(quietRef.current)
  })

  useEffect(() => {
    if (!printJob) return
    return printPaper(printJob.title, () =>
      dispatchPrint({ type: "print_finished" })
    )
  }, [printJob])

  if (!token || query.isError) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-lg font-medium">
          This link does not open a document.
        </h1>
      </main>
    )
  }
  if (query.isLoading || !query.data) {
    return (
      <main className="p-8">
        <p>Loading documents</p>
      </main>
    )
  }
  const doc = query.data
  const stored = doc.paper.kind === doc.kind ? doc.paper : null
  const cv = doc.kind === "cv" ? previewOf(stored, doc.templateId) : null
  const letter = doc.kind === "letter" ? letterOf(doc.paper) : null

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">{doc.name}</h1>
        <Button
          size="touch"
          type="button"
          variant="outline"
          onClick={() =>
            dispatchPrint({ type: "print_requested", title: doc.name })
          }
        >
          Download PDF
        </Button>
      </div>
      {printJob ? (
        <PaperPrintSheet
          name={doc.name}
          kind={doc.kind}
          source={stored}
          templateId={doc.templateId}
          docId={doc.id}
          shareToken={token}
        />
      ) : null}
      <div ref={quietRef} data-paper-quiet="" inert className="min-w-0">
        {cv ? (
          <CvPhotoFrame value={{ shareToken: token }}>
            <CvDocument data={cv} onChange={() => undefined} />
          </CvPhotoFrame>
        ) : letter ? (
          <LetterPrintView document={letter} />
        ) : null}
      </div>
    </main>
  )
}
