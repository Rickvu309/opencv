import { FileWarning, LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

export type PaperImportState =
  | { type: "idle" }
  | { type: "importing"; name: string }
  | { type: "error"; message: string }

export function PaperImportScreen({
  state,
  onCancel,
  onRetry,
  onBlank,
  creatingBlank = false,
}: {
  state: Exclude<PaperImportState, { type: "idle" }>
  onCancel: () => void
  onRetry: () => void
  onBlank: () => void
  creatingBlank?: boolean
}) {
  return (
    <section
      aria-label="Import CV"
      className="flex min-h-full min-w-0 flex-col gap-6 p-4 sm:p-6"
    >
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Paper
        </Button>
        <span aria-hidden>/</span>
        <span>{state.type === "importing" ? state.name : "Import"}</span>
      </nav>
      {state.type === "importing" ? (
        <div
          className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 rounded-lg border border-border bg-card p-6 sm:p-12"
          aria-busy="true"
        >
          <Skeleton className="h-7 w-2/5" />
          {["Experience", "Education", "Skills"].map((section) => (
            <div key={section} className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide uppercase">
                {section}
              </p>
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
          <div
            role="status"
            className="mt-auto flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-4"
          >
            <LoaderCircle
              aria-hidden
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Importing</p>
              <p className="truncate text-xs text-muted-foreground">
                {state.name}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="m-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
          <FileWarning aria-hidden className="size-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Can't read this file</h1>
          <p role="alert" className="text-sm text-muted-foreground">
            {state.message}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={onRetry}>Choose another file</Button>
            <Button
              variant="outline"
              onClick={onBlank}
              disabled={creatingBlank}
            >
              Start blank
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
