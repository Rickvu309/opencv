import { Link } from "@tanstack/react-router"
import type { JobView } from "@workspace/domain/apply"
import type { PaperView } from "@workspace/domain/paper-doc"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

export function PaperLinkDialog({
  open,
  doc,
  jobs,
  jobsLoading,
  jobsError,
  onClose,
  onLink,
}: {
  open: boolean
  doc: PaperView | null
  jobs: JobView[]
  jobsLoading: boolean
  jobsError: string | null
  onClose: () => void
  onLink: (job: JobView) => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {doc === null ? null : (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to application</DialogTitle>
            <DialogDescription>
              Choose the job this page belongs to.
            </DialogDescription>
          </DialogHeader>
          {jobsLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Loading jobs…
            </p>
          ) : null}
          {jobsError ? (
            <p role="alert" className="text-sm text-destructive">
              {jobsError}
            </p>
          ) : null}
          {!jobsLoading && !jobsError && jobs.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">No jobs yet.</p>
              <Link
                to={SURFACE_PATHS.apply}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-11 md:h-8"
                )}
              >
                Add a job in Apply
              </Link>
            </div>
          ) : null}
          {jobs.length > 0 ? (
            <div
              data-slot="paper-link-jobs"
              className="grid max-h-72 gap-2 overflow-y-auto overscroll-contain"
            >
              {jobs.map((job) => (
                <Button
                  key={job.id}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-11 justify-start whitespace-normal md:min-h-0"
                  onClick={() => onLink(job)}
                >
                  {job.title}, {job.company}
                </Button>
              ))}
            </div>
          ) : null}
        </DialogContent>
      )}
    </Dialog>
  )
}
