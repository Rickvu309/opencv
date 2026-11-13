import { Suspense, lazy } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ERROR_CODES, paperIdSchema, parsePaperId } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import {
  getPaper,
  getPaperPages,
  listPaper,
  paperGetKey,
  paperListKey,
  paperPagesKey,
} from "@/features/paper/paper-api.ts"
import { jobListKey, listJobs } from "@/features/apply/apply-api.ts"
import { draftFromPage } from "@/features/paper-page/canvas-edit.ts"
import { readWordPage } from "@/features/paper-page/package-read.ts"
import { WritingPage } from "@/features/paper/writing-page.tsx"
import { validatePaperSearch } from "@/features/paper/paper-templates.ts"
import { useShellProfile } from "@/features/app-shell/use-shell-profile.ts"
import { authClient } from "@/lib/auth-client.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { ApiError } from "@/lib/api-error.ts"
import {
  paperListRecheck,
  paperListRecheckKey,
  retryPaperDocReads,
} from "@/lib/paper-list-recheck.ts"

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
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: paperListKey(),
    queryFn: listPaper,
  })
  const listed =
    validId === null
      ? undefined
      : listQuery.data?.find((item) => item.id === validId)
  const wordPage = listed?.format === "word"
  const packageRead = catalogClient.options(owner, "paper.read", {
    view: "page",
    docId: validId ?? NO_DOC,
  })
  const wordReadFailed =
    wordPage &&
    queryClient.getQueryState(packageRead.queryKey)?.status === "error"
  const recheckWanted =
    validId !== null &&
    listQuery.isSuccess &&
    (listed === undefined || wordReadFailed)
  const recheck = useQuery({
    ...paperListRecheck(
      queryClient,
      { queryKey: paperListKey(), queryFn: listPaper },
      validId ?? NO_DOC
    ),
    enabled: recheckWanted,
  })
  const rechecking =
    recheck.isFetching ||
    (recheckWanted && !recheck.isSuccess && !recheck.isError)
  const kindKnown =
    listed !== undefined ||
    listQuery.isError ||
    recheck.isSuccess ||
    recheck.isError
  const docQuery = useQuery({
    queryKey: paperGetKey(validId ?? NO_DOC),
    queryFn: () => getPaper(docId),
    enabled: validId !== null && kindKnown && !wordPage,
    placeholderData: wordPage ? undefined : listed,
  })
  const docMissing =
    !docQuery.data &&
    docQuery.error instanceof ApiError &&
    docQuery.error.code === ERROR_CODES.NOT_FOUND
  const askWordPage =
    validId !== null && (wordPage || (listQuery.isError && docMissing))
  const packageQuery = useQuery({
    queryKey: packageRead.queryKey,
    meta: packageRead.meta,
    queryFn: ({ signal }) => readWordPage(owner, validId ?? NO_DOC, signal),
    enabled: askWordPage && owner !== "",
    retry: false,
  })
  const packagePage = packageQuery.data ?? null
  const seeded = packagePage ? draftFromPage(packagePage) : null
  const packagePending =
    askWordPage &&
    (session.isPending || (owner !== "" && packageQuery.isLoading))
  const pagesQuery = useQuery({
    queryKey: paperPagesKey(validId ?? NO_DOC),
    queryFn: () => getPaperPages(docId),
    enabled: !wordPage && docQuery.data?.kind === "cv",
  })
  const jobsQuery = useQuery({
    queryKey: jobListKey(),
    queryFn: listJobs,
    enabled: !wordPage && docQuery.data?.kind === "letter",
  })
  const back = () => void navigate({ to: SURFACE_PATHS.paper, search })

  if (
    (validId !== null && !kindKnown) ||
    rechecking ||
    docQuery.isLoading ||
    packagePending
  ) {
    return (
      <section aria-label="Paper" className="p-4">
        <p>Loading documents</p>
      </section>
    )
  }
  if (wordPage || !docQuery.data) {
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
      (docMissing && (!listQuery.isError || packageQuery.isSuccess)) ||
      (wordPage && packageQuery.isSuccess)
    const retry = () =>
      void retryPaperDocReads(queryClient, [
        paperListKey(),
        paperListRecheckKey(validId ?? NO_DOC),
        paperGetKey(validId ?? NO_DOC),
        packageRead.queryKey,
      ])
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
        <div className="flex gap-2">
          {missing ? null : (
            <Button type="button" onClick={retry}>
              Refresh
            </Button>
          )}
          <Button type="button" variant="outline" onClick={back}>
            Paper
          </Button>
        </div>
      </section>
    )
  }
  const doc = docQuery.data
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
