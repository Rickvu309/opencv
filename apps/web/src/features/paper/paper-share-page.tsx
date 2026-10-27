import { useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { blocksToPreviewModel, readCvBlocks } from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"

import { CvDocument } from "./paper-cv-preview.tsx"
import { asRecord } from "./paper-api.ts"
import { printLayout } from "./paper-templates.ts"

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
    queryKey: ["paper", "share", token],
    queryFn: async () => {
      const body = await apiFetch<SuccessBody<unknown>>(
        `/api/paper/shared/${token}`
      )
      return asRecord(unwrapData(body))
    },
    enabled: token.length > 0,
  })

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
  const blocks = doc.kind === "cv" ? readCvBlocks(doc.document) : null
  const markdown =
    doc.document &&
    typeof doc.document === "object" &&
    "markdown" in doc.document
      ? String((doc.document as { markdown: unknown }).markdown ?? "")
      : ""

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-lg font-medium">{doc.name}</h1>
      <div inert className="min-w-0">
        {blocks ? (
          <CvDocument
            data={blocksToPreviewModel(blocks, printLayout(doc.templateId))}
            onChange={() => undefined}
          />
        ) : (
          <article className="rounded-lg border border-border bg-card p-6 whitespace-pre-wrap">
            {markdown}
          </article>
        )}
      </div>
    </main>
  )
}
