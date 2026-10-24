import { Plus, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Empty, EmptyDescription } from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import type { PaperContentKind } from "@workspace/domain"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { WorkspaceHeader } from "@/components/workspace-header.tsx"

import {
  SAMPLE_CV_LABEL,
  TYPE_LABEL,
  formatPaperUpdated,
  isSampleCv,
  type PaperDoc,
  type PaperZeroState,
  type PaperZeroStateId,
} from "./paper-data.ts"
import { RowMenu, StatusBadge, type RowMenuProps } from "./paper-row-menu.tsx"

const TABLE_WIDTH = "min-w-[48rem]"

type Props = {
  docs: PaperDoc[]
  isLoading: boolean
  loadFailed: boolean
  onReload: () => void
  creating: boolean
  query: string
  onQuery: (query: string) => void
  companyOf: (doc: PaperDoc) => string | undefined
  zeroStates: PaperZeroState[]
  onZeroState: (id: PaperZeroStateId) => void
  onCreate: (kind: PaperContentKind) => void
  onOpen: (id: string) => void
  rowActions: (doc: PaperDoc) => Omit<RowMenuProps, "doc">
}

export function PaperDrive({
  docs,
  isLoading,
  loadFailed,
  onReload,
  creating,
  query,
  onQuery,
  companyOf,
  zeroStates,
  onZeroState,
  onCreate,
  onOpen,
  rowActions,
}: Props) {
  return (
    <>
      <WorkspaceHeader title="Paper">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search CVs, Letters and Proof"
            className="h-8 pl-8"
            aria-label="Search Paper"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" size="sm" disabled={creating} />}
            aria-label="New"
          >
            <Plus className="size-3.5" />
            New
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem onClick={() => onCreate("cv")}>
              CV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreate("letter")}>
              Letter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreate("proof")}>
              Proof
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </WorkspaceHeader>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          {loadFailed && !isLoading ? <LoadError onReload={onReload} /> : null}
          <div className="overflow-x-auto">
            {isLoading ? (
              <DriveLoading />
            ) : docs.length === 0 ? (
              loadFailed ? null : (
                <Empty className="py-8">
                  <EmptyDescription>
                    {query.trim()
                      ? "No documents match that search."
                      : "No documents yet. Create a CV, Letter, or Proof to start."}
                  </EmptyDescription>
                </Empty>
              )
            ) : (
              <table className={`w-full ${TABLE_WIDTH} text-left text-sm`}>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Updated</th>
                    <th className="px-4 py-2.5 font-medium">Apply</th>
                    <th className="w-10 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => onOpen(doc.id)}
                      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                            {doc.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium">
                              {doc.name}
                            </span>
                            {isSampleCv(doc) ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {SAMPLE_CV_LABEL}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {TYPE_LABEL[doc.kind]}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatPaperUpdated(doc.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {companyOf(doc) ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <RowMenu doc={doc} {...rowActions(doc)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {!isLoading && !loadFailed && zeroStates.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {zeroStates.map((state) => (
              <Button
                key={state.id}
                type="button"
                variant="outline"
                aria-label={state.title}
                aria-describedby={`paper-zero-${state.id}`}
                className="h-auto flex-col items-start gap-1 bg-background px-4 py-3 text-left whitespace-normal"
                onClick={() => onZeroState(state.id)}
              >
                <span className="text-sm font-medium">{state.title}</span>
                <span
                  id={`paper-zero-${state.id}`}
                  className="text-xs font-normal text-muted-foreground"
                >
                  {state.hint}
                </span>
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}

function DriveLoading() {
  return (
    <div className={TABLE_WIDTH}>
      <p
        aria-live="polite"
        className="px-4 py-2.5 text-xs text-muted-foreground"
      >
        Loading documents…
      </p>
      <div aria-hidden className="grid gap-px">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex h-14 items-center gap-3 border-t border-border px-4"
          >
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadError({ onReload }: { onReload: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <ErrorBanner variant="inline">
        Couldn&apos;t load your CVs, Letters and Proof. Check your connection,
        then try again.
      </ErrorBanner>
      <Button type="button" variant="outline" size="sm" onClick={onReload}>
        Retry
      </Button>
    </div>
  )
}
