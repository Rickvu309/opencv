import { Suspense, lazy } from "react"
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
import { SegmentedControl } from "@workspace/ui/components/segmented-control"
import { ShimmerText, Skeleton } from "@workspace/ui/components/shimmer-loader"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import type { PaperContentKind } from "@workspace/domain"

import { ErrorBanner } from "@/components/error-banner.tsx"
import type { LayerStackItem } from "@/components/layer-stack.tsx"
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

const LayerStack = lazy(() =>
  import("@/components/layer-stack.tsx").then((m) => ({
    default: m.LayerStack,
  }))
)

const KIND_OPTIONS = [
  { value: "all", label: "All" },
  { value: "cv", label: "CV" },
  { value: "letter", label: "Letter" },
  { value: "proof", label: "Proof" },
] as const

const EMPTY_LAYERS: LayerStackItem[] = [
  { title: "CV", hint: "Your story", icon: "bolt" },
  { title: "Letter", hint: "One Opportunity", icon: "pulse" },
  { title: "Proof", hint: "Work you made", icon: "spark" },
]

export type PaperKindFilter = "all" | PaperContentKind

type Props = {
  docs: PaperDoc[]
  kind: PaperKindFilter
  onKind: (kind: PaperKindFilter) => void
  counts: Record<PaperKindFilter, number>
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
  kind,
  onKind,
  counts,
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
        {!isLoading && counts.all > 0 ? (
          <SegmentedControl
            aria-label="Show"
            size="sm"
            value={kind}
            onChange={onKind}
            className="mb-4"
            options={KIND_OPTIONS.map((option) => ({
              ...option,
              count: counts[option.value],
            }))}
          />
        ) : null}
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          {loadFailed && !isLoading ? <LoadError onReload={onReload} /> : null}
          {isLoading ? (
            <DriveLoading />
          ) : docs.length === 0 ? (
            loadFailed ? null : counts.all === 0 && !query.trim() ? (
              <EmptyDrive />
            ) : (
              <Empty className="py-8">
                <EmptyDescription>
                  No documents match that search.
                </EmptyDescription>
              </Empty>
            )
          ) : (
            <Table className="min-w-[48rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Name</TableHead>
                  <TableHead className="px-4">Type</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                  <TableHead className="px-4">Updated</TableHead>
                  <TableHead className="px-4">Apply</TableHead>
                  <TableHead className="w-10 px-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow
                    key={doc.id}
                    onClick={() => onOpen(doc.id)}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                          {doc.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <Button
                            type="button"
                            variant="link"
                            aria-label={`Open ${doc.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpen(doc.id)
                            }}
                            className="h-auto p-0 font-medium text-foreground"
                          >
                            {doc.name}
                          </Button>
                          {isSampleCv(doc) ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {SAMPLE_CV_LABEL}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {TYPE_LABEL[doc.kind]}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {formatPaperUpdated(doc.updatedAt)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {companyOf(doc) ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <RowMenu doc={doc} {...rowActions(doc)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
    <div aria-busy="true" className="min-w-[48rem]">
      <p aria-live="polite" className="px-4 py-2.5 text-xs">
        <ShimmerText>Loading documents…</ShimmerText>
      </p>
      <div className="grid gap-px">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex h-14 items-center gap-3 border-t border-border px-4"
          >
            <Skeleton circle width={32} />
            <Skeleton width={192} height={16} />
            <Skeleton width={96} height={16} className="ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyDrive() {
  return (
    <Empty className="py-8">
      <div className="hidden w-full max-w-xl sm:block">
        <Suspense fallback={null}>
          <LayerStack items={EMPTY_LAYERS} interval={3200} />
        </Suspense>
      </div>
      <EmptyDescription>
        No documents yet. Create a CV, Letter, or Proof to start.
      </EmptyDescription>
    </Empty>
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
