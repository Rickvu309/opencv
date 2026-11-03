import { useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useReducer, useRef } from "react"
import {
  cvPrintModel,
  type CvDocument as CvDocumentData,
  type CvPaper,
  type LetterPaper,
} from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"

import { CvDocument } from "./cv-print-document.tsx"
import { LetterPrintView } from "./paper-letter-print.tsx"
import { CvPhotoFrame } from "./cv-templates/cv-parts.tsx"
import { getSharedPaper, paperSharedKey } from "./paper-api.ts"
import { PaperPrintSheet } from "./paper-print-sheet.tsx"
import { printPaper, quietPaperChrome } from "./paper-print.ts"
import { printJobReducer } from "./paper-print-job.reducer.ts"
import { printLayout } from "./paper-templates.ts"

function asCvPaper(source: unknown): CvPaper | null {
  if (!source || typeof source !== "object") return null
  const record = source as { version?: unknown; kind?: unknown }
  if (record.version !== 3 || record.kind !== "cv") return null
  return source as CvPaper
}

function asLetterPaper(source: unknown): LetterPaper | null {
  if (!source || typeof source !== "object") return null
  const record = source as { version?: unknown; kind?: unknown }
  if (record.version !== 3 || record.kind !== "letter") return null
  return source as LetterPaper
}

function sharedCv(
  paper: unknown,
  templateId: string | null
): CvDocumentData | null {
  const cv = asCvPaper(paper)
  if (!cv) return null
  return cvPrintModel(cv, printLayout(templateId))
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
  const cv = doc.kind === "cv" ? sharedCv(doc.paper, doc.templateId) : null
  const letter = doc.kind === "letter" ? asLetterPaper(doc.paper) : null

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">{doc.name}</h1>
        <Button
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
          source={doc.paper}
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
