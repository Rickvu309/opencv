import { Suspense, lazy } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ERROR_CODES, paperIdSchema, parsePaperId } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import {
  getPaper,
  getPaperPages,
  paperGetKey,
  paperPagesKey,
} from "@/features/paper/paper-api.ts"
import { jobListKey, listJobs } from "@/features/apply/apply-api.ts"
import {
  draftFromRegions,
  opensWritingCanvas,
} from "@/features/paper-page/canvas-edit.ts"
import { readWholePackage } from "@/features/paper-page/package-read.ts"
import { WritingPage } from "@/features/paper/writing-page.tsx"
import { validatePaperSearch } from "@/features/paper/paper-templates.ts"
import { useShellProfile } from "@/features/app-shell/use-shell-profile.ts"
import { authClient } from "@/lib/auth-client.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { ApiError } from "@/lib/api-error.ts"

const PaperLetterEditor = lazy(() =>
  import("@/features/paper/paper-letter.tsx").then((module) => ({
    default: module.PaperLetterEditor,
  }))
)

const PaperCvEditor = lazy(() =>
  import("@/features/paper/paper-cv-editor.tsx").then((module) => ({
    default: module.PaperCvEditor,
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
  const profile = useShellProfile()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const routeSearch = useRouterState({
    select: (state) => state.location.search,
  })
  const search = validatePaperSearch(routeSearch)
  const docId = docIdFromPath(pathname)
  const parsedId = paperIdSchema.safeParse(docId)
  const validId = parsedId.success ? parsedId.data : null
  const session = authClient.useSession()
  const owner = session.data?.user.id ?? ""
  const docQuery = useQuery({
    queryKey: paperGetKey(validId ?? NO_DOC),
    queryFn: () => getPaper(docId),
    enabled: validId !== null,
  })
  const packageMissing =
    validId !== null &&
    !docQuery.isLoading &&
    !docQuery.data &&
    docQuery.error instanceof ApiError &&
    docQuery.error.code === ERROR_CODES.NOT_FOUND
  const packageRead = catalogClient.options(owner, "paper.read", {
    docId: validId ?? NO_DOC,
  })
  const packageQuery = useQuery({
    queryKey: packageRead.queryKey,
    meta: packageRead.meta,
    queryFn: ({ signal }) => readWholePackage(owner, validId ?? NO_DOC, signal),
    enabled: packageMissing && owner !== "",
    retry: false,
  })
  const packagePage =
    packageQuery.data && "regions" in packageQuery.data
      ? packageQuery.data
      : null
  const seeded = packagePage ? draftFromRegions(packagePage.regions) : null
  const packagePending =
    packageMissing &&
    (session.isPending || (owner !== "" && packageQuery.isLoading))
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
  const back = () => void navigate({ to: SURFACE_PATHS.paper, search })

  if (docQuery.isLoading || packagePending) {
    return (
      <section aria-label="Paper" className="p-4">
        <p>Loading documents</p>
      </section>
    )
  }
  if (!docQuery.data) {
    if (seeded && validId && packagePage) {
      return (
        <WritingPage
          key={validId}
          docId={validId}
          seed={seeded}
          seedRevision={packagePage.revision}
        />
      )
    }
    const missing =
      validId === null ||
      (docQuery.error instanceof ApiError &&
        docQuery.error.code === ERROR_CODES.NOT_FOUND)
    return (
      <section
        aria-label="Paper"
        className="flex flex-col items-start gap-3 p-4"
      >
        <p>
          {missing
            ? "Document not found."
            : "Could not load documents. Refresh the page."}
        </p>
        <Button type="button" variant="outline" onClick={back}>
          Paper
        </Button>
      </section>
    )
  }
  const doc = docQuery.data
  if (opensWritingCanvas(doc)) {
    return <WritingPage key={doc.id} docId={doc.id} />
  }
  if (doc.kind === "letter") {
    const job =
      jobsQuery.data?.find((item) => item.letterDocId === doc.id) ?? null
    return (
      <Suspense fallback={<LetterEditorFallback />}>
        <PaperLetterEditor key={doc.id} doc={doc} job={job} onBack={back} />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={<LetterEditorFallback />}>
      <PaperCvEditor
        key={doc.id}
        initial={doc}
        seedName={profile.name}
        pages={
          pagesQuery.data ?? {
            docId: doc.id,
            pages: 1,
            pageChoice: doc.pageChoice,
          }
        }
        onBack={back}
      />
    </Suspense>
  )
}
