import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { paperPackageMetadataSchema, type z } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { ApiError } from "@/lib/api.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"
import { authClient } from "@/lib/auth-client.ts"
import { catalogClient, refreshCatalogReads } from "@/lib/contract-client.ts"

export type WordDocument = z.output<typeof paperPackageMetadataSchema>

export function useWordLibrary(filter: string, needle: string) {
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const owner = session?.user.id ?? ""
  const [after, setAfter] = useState<string>()
  const [selected, onSelect] = useState<WordDocument | null>(null)
  const query = useQuery({
    ...catalogClient.options(owner, "paper.read", {
      view: "library",
      ...(after ? { after } : {}),
    }),
    enabled: owner !== "",
    retry: false,
  })
  const items = query.data && "items" in query.data ? query.data.items : []
  const next = query.data && "items" in query.data ? query.data.next : null
  const visible = items.filter(
    (document) =>
      (filter === "all" || filter === document.kind) &&
      document.name.toLowerCase().includes(needle)
  )
  function imported(document: WordDocument, signal: AbortSignal) {
    void refreshCatalogReads(queryClient)
    if (!signal.aborted) onSelect(document)
  }
  return {
    owner,
    query,
    items,
    visible,
    after,
    next,
    setAfter,
    selected,
    onSelect,
    imported,
  }
}

export function PaperPackageLibrary({
  library,
}: {
  library: ReturnType<typeof useWordLibrary>
}) {
  const { selected, onSelect } = library
  const unavailable =
    library.query.error instanceof ApiError &&
    library.query.error.status === 404
  const items = library.visible
  return (
    <>
      {!unavailable && library.owner !== "" ? (
        <section aria-label="Word documents" className="flex flex-col gap-3">
          {library.query.isLoading ? <p>Loading Word documents</p> : null}
          {library.query.error ? (
            <div>
              <p>Could not load Word documents.</p>
              <Button
                className="h-11 md:h-9"
                variant="outline"
                onClick={() => void library.query.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : null}
          {items.length > 0 ? (
            <>
              <h2 className="text-sm font-medium">Word documents</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((document) => (
                  <Button
                    key={document.docId}
                    variant="outline"
                    className="h-auto min-h-11 justify-start p-4 text-left whitespace-normal"
                    onClick={() => onSelect(document)}
                  >
                    {document.name}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
          {library.after || library.next ? (
            <div className="flex gap-2">
              {library.after ? (
                <Button
                  className="h-11 md:h-9"
                  variant="outline"
                  onClick={() => library.setAfter(undefined)}
                >
                  First documents
                </Button>
              ) : null}
              {library.next ? (
                <Button
                  className="h-11 md:h-9"
                  variant="outline"
                  onClick={() => library.setAfter(library.next ?? undefined)}
                >
                  More documents
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) onSelect(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.name ?? "Word document"}</DialogTitle>
            <DialogDescription>
              Text preview of this saved Word version. Download Word to keep its
              original layout.
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <WordSnapshot
              key={`${selected.docId}:${selected.revision}`}
              document={selected}
              owner={library.owner}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function WordSnapshot({
  document,
  owner,
}: {
  document: WordDocument
  owner: string
}) {
  const [cursor, setCursor] = useState<string>()
  const page = useQuery({
    ...catalogClient.options(owner, "paper.read", {
      docId: document.docId,
      at: document.revision,
      ...(cursor ? { cursor } : {}),
    }),
    enabled: owner !== "",
    retry: false,
  })
  const download = useQuery({
    ...catalogClient.options(owner, "paper.export", {
      docId: document.docId,
      at: document.revision,
    }),
    enabled: owner !== "",
    retry: false,
  })
  const snapshot = page.data && "regions" in page.data ? page.data : null
  return (
    <div className="flex flex-col gap-4">
      {download.data ? (
        <a
          href={`${apiBaseUrl}${download.data.downloadPath}`}
          className="text-sm underline underline-offset-4"
        >
          Download Word
        </a>
      ) : null}
      {download.error ? <p>Could not prepare this Word download.</p> : null}
      {page.isLoading ? <p>Loading saved text</p> : null}
      {page.error ? (
        <div>
          <p>Could not load this saved version. Your file has not changed.</p>
          <Button
            className="h-11 md:h-9"
            variant="outline"
            onClick={() => void page.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {snapshot ? (
        <>
          <div aria-label="Saved document text" className="space-y-3">
            {snapshot.regions.map((region, index) => (
              <div key={index}>
                <p className="break-words whitespace-pre-wrap">{region.text}</p>
                {region.kind === "locked" ? (
                  <p className="text-xs text-muted-foreground">
                    {region.reason.message}
                    {region.complete
                      ? ""
                      : " More text continues on the next page."}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {cursor || snapshot.nextCursor ? (
            <div className="flex gap-2">
              {cursor ? (
                <Button
                  className="h-11 md:h-9"
                  variant="outline"
                  onClick={() => setCursor(undefined)}
                >
                  First page
                </Button>
              ) : null}
              {snapshot.nextCursor ? (
                <Button
                  className="h-11 md:h-9"
                  variant="outline"
                  onClick={() => setCursor(snapshot.nextCursor ?? undefined)}
                >
                  Next page
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
