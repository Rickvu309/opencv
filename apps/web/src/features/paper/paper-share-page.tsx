import { useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { isCvDocument } from "@workspace/domain"

import { CvDocument } from "./paper-cv-document.tsx"
import { getSharedPaper, paperSharedKey } from "./paper-api.ts"
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
    queryKey: paperSharedKey(token),
    queryFn: () => getSharedPaper(token),
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
        {doc.kind === "letter" || !isCvDocument(doc.document) ? (
          <article className="rounded-lg border border-border bg-card p-6 whitespace-pre-wrap">
            {markdown}
          </article>
        ) : (
          <CvDocument
            data={{ ...doc.document, templateId: printLayout(doc.templateId) }}
            onChange={() => undefined}
          />
        )}
      </div>
    </main>
  )
}
