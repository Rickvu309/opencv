import { Suspense, lazy } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  ERROR_CODES,
  catalog,
  paperIdSchema,
  parsePaperId,
} from "@workspace/domain/kernel"
import { RICH_NATIVE_WRITER } from "@workspace/domain/paper-doc"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { validatePaperSearch } from "@/features/paper/paper-templates.ts"
import { authClient } from "@/lib/auth-client.ts"
import { queryKey } from "@/lib/contract-client.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { ApiError } from "@/lib/api-error.ts"
import {
  qualifiedPaperKey,
  qualifiedPaperRead,
} from "@/lib/paper-qualification.ts"

const RichPaperPage = lazy(() =>
  import("@/features/paper/rich-editor/rich-page.tsx").then((module) => ({
    default: module.RichPaperPage,
  }))
)

const NO_DOC = parsePaperId("00000000-0000-4000-8000-000000000000")
const PAPER_PREFIX = `${SURFACE_PATHS.paper}/`

function docIdFromPath(pathname: string) {
  if (!pathname.startsWith(PAPER_PREFIX)) return ""
  return decodeURIComponent(
    pathname.slice(PAPER_PREFIX.length).split("/")[0] ?? ""
  )
}

function LetterEditorFallback() {
  return (
    <section
      aria-label="Paper"
      aria-busy="true"
      className="flex flex-col items-center gap-4 p-6"
    >
      <Skeleton className="h-[792px] w-full max-w-[560px]" />
    </section>
  )
}

export function PaperDocPage() {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const routeSearch = useRouterState({
    select: (state) => state.location.search,
  })
  const search = validatePaperSearch(routeSearch)
  const parsedId = paperIdSchema.safeParse(docIdFromPath(pathname))
  const docId = parsedId.success ? parsedId.data : null
  const session = authClient.useSession()
  const ownerId = session.data?.user.id ?? ""
  const sessionId = session.data?.session.id ?? ""
  const qualification = { ownerId, sessionId, writer: RICH_NATIVE_WRITER }
  const ready = docId !== null && ownerId !== "" && sessionId !== ""
  const document = useQuery({
    queryKey: ready
      ? qualifiedPaperKey(
          queryKey({
            query: catalog["paper.read"].name,
            input: { view: "info", docId },
          }),
          qualification
        )
      : ["paper-document-unavailable", docId],
    queryFn: ({ signal }) =>
      qualifiedPaperRead(catalog["paper.read"].name, docId ?? NO_DOC, {
        ...qualification,
        signal,
      }),
    enabled: ready,
    retry: false,
  })
  const back = () => void navigate({ to: SURFACE_PATHS.paper, search })
  const notOpened = (message: string) => (
    <section aria-label="Paper" className="flex flex-col items-start gap-3 p-4">
      <p>{message}</p>
      <Button variant="outline" onClick={back}>
        Paper
      </Button>
    </section>
  )
  if (docId === null) return notOpened("Document not found.")
  if (session.isPending || (ready && document.isLoading))
    return <LetterEditorFallback />
  if (!document.data)
    return (
      <section
        aria-label="Paper"
        className="flex flex-col items-start gap-3 p-4"
      >
        <p>
          {document.error instanceof ApiError &&
          document.error.code === ERROR_CODES.NOT_FOUND
            ? "Document not found."
            : "Could not open this document."}
        </p>
        {document.error instanceof ApiError &&
        document.error.code === ERROR_CODES.NOT_FOUND ? null : (
          <Button onClick={() => void document.refetch()}>Try again</Button>
        )}
        <Button variant="outline" onClick={back}>
          Paper
        </Button>
      </section>
    )
  if (document.data.format !== "rich")
    return notOpened("This document cannot be opened in Paper.")
  return (
    <Suspense fallback={<LetterEditorFallback />}>
      <RichPaperPage
        key={`${ownerId}:${sessionId}:${docId}`}
        name={document.data.name}
        kind={document.data.kind}
        editedAt={document.data.updatedAt}
        identity={{
          kind: "native",
          ownerId,
          sessionId,
          docId,
          writer: RICH_NATIVE_WRITER,
          provenance: document.data.provenance,
        }}
        onBack={back}
        onOpen={(id) =>
          void navigate({ to: "/paper/$docId", params: { docId: id }, search })
        }
      />
    </Suspense>
  )
}
